# CUCCU-POS API

A REST API for Cuccu Cafe's POS/inventory system, built on Express and Supabase
(Postgres + Auth). It sits on top of an existing Supabase project and schema —
this API does not manage the database schema itself, only exposes it safely
over HTTP. It also includes a real GCash/Maya payment integration via PayMongo.

**Live deployment:** `https://cuccu-pos-api.onrender.com`

## How authorization actually works here

This is the single most important thing to understand before touching the code.

Your Supabase database already has **Row-Level Security (RLS)** policies that
decide what an `owner` vs a `cashier` can read/write, table by table. This API
does **not** duplicate that logic with a privileged admin key. Instead:

1. A user logs in via `/api/auth/login` and gets a Supabase access token (JWT).
2. Every subsequent request sends that token in `Authorization: Bearer <token>`.
3. The API verifies the token, then creates a **Supabase client scoped to that
   user's own token** and uses it for all database calls.
4. Postgres RLS policies enforce what that specific user can do — the API
   is a thin, secure pass-through, not the security boundary itself.

Express-level role checks (`requireRole("owner")`) exist too, but only as a
**fast-fail UX layer** that returns a clean 403 before hitting the database.
The real enforcement is RLS. If you ever add a new route and forget the
Express-level check, RLS still protects the data — it just returns a less
friendly error.

This means: **no Supabase secret/service-role key is used anywhere in this
project.** Only the publishable key + per-user JWTs.

### The one exception: the payments webhook

PayMongo calls `POST /api/payments/webhook` directly, server-to-server, with
**no user JWT at all** — there's no logged-in user to scope a client to. This
route cannot use the RLS pattern above by definition. Instead of reaching for
the secret key (which would bypass RLS entirely and broadly), this API uses
two narrow **`SECURITY DEFINER`** Postgres functions — the same pattern your
schema already used for `handle_new_user()` and `get_user_role()`:

- `find_payment_by_provider_id(source_id, payment_id)` — looks up a payment
  row by its PayMongo identifiers, bypassing RLS just for this one read.
- `update_payment_status(payment_id, status, ...)` — flips a payment's status
  and, when the status is `'paid'`, also marks the linked order `'completed'`
  (which reuses your existing inventory-deduction trigger automatically).

Both are called via `supabase.rpc(...)` using the anon/publishable client —
no secret key anywhere. Security instead comes from **HMAC signature
verification** on the webhook request itself (see below): if the signature
doesn't match, the request never reaches these functions at all.

## Tech stack

- Node.js + Express
- Supabase (`@supabase/supabase-js`) — Postgres + Auth
- `jose` — verifies user JWTs locally against Supabase's JWKS endpoint
  (no extra round-trip to Supabase per request)
- `zod` — request body validation
- `helmet`, `cors`, `express-rate-limit` — security middleware
- Native `fetch` (Node 18+) — calls to the PayMongo REST API, no SDK needed
- `vitest` + `supertest` — automated integration tests

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase and PayMongo values:

```bash
cp .env.example .env
```

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
SUPABASE_JWKS_URL=https://your-project-ref.supabase.co/auth/v1/.well-known/jwks.json
PORT=4000
ALLOWED_ORIGINS=http://127.0.0.1:5500

PAYMONGO_SECRET_KEY=sk_test_your_key_here
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

`ALLOWED_ORIGINS` is a comma-separated list of frontend origins allowed by CORS.
If left empty, CORS blocks all cross-origin requests (fails closed, not open).

`PAYMONGO_SECRET_KEY` comes from PayMongo Dashboard → Developers (test mode
key starts with `sk_test_`). `PAYMONGO_WEBHOOK_SECRET` is generated when you
register a webhook endpoint in PayMongo Dashboard → Developers → Webhooks —
see the "PayMongo webhook setup" section below.

### 3. Create test users

Passwords are hashed by Supabase Auth and cannot be viewed after creation —
only reset. To create a user for testing:

1. Supabase Dashboard → Authentication → Users → Add user
2. Set an email and password, check "Auto Confirm User"
3. A `profiles` row is created automatically (default role: `cashier`) via
   the existing `handle_new_user` trigger
4. To promote someone to `owner`, run in the Supabase SQL Editor:
   ```sql
   UPDATE public.profiles SET role = 'owner'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'owner@example.com');
   ```

### 4. Set up the payments database functions

Run these in the Supabase SQL Editor (once per project — not needed again
after initial setup):

```sql
-- Bypasses RLS narrowly to look up a payment by PayMongo's own identifiers.
-- Needed because the webhook has no logged-in user to scope a query to.
CREATE OR REPLACE FUNCTION public.find_payment_by_provider_id(
    p_source_id text DEFAULT NULL,
    p_payment_id text DEFAULT NULL
)
RETURNS TABLE (id bigint, order_id bigint, amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
    IF p_source_id IS NOT NULL THEN
        RETURN QUERY
        SELECT p.id, p.order_id, p.amount
        FROM public.payments p
        WHERE p.paymongo_source_id = p_source_id;
    ELSIF p_payment_id IS NOT NULL THEN
        RETURN QUERY
        SELECT p.id, p.order_id, p.amount
        FROM public.payments p
        WHERE p.paymongo_payment_id = p_payment_id;
    END IF;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.find_payment_by_provider_id(text, text) TO anon;

-- Flips a payment's status, and auto-completes the linked order once paid.
-- Reuses your existing order-completion trigger for inventory deduction —
-- does not duplicate that logic.
CREATE OR REPLACE FUNCTION public.update_payment_status(
    p_payment_id bigint,
    p_status text,
    p_paymongo_source_id text DEFAULT NULL,
    p_paymongo_payment_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
    v_order_id bigint;
BEGIN
    IF p_status NOT IN ('pending', 'chargeable', 'paid', 'failed') THEN
        RAISE EXCEPTION 'Invalid payment status: %', p_status;
    END IF;

    UPDATE public.payments
    SET
        status = p_status,
        paymongo_source_id = COALESCE(p_paymongo_source_id, paymongo_source_id),
        paymongo_payment_id = COALESCE(p_paymongo_payment_id, paymongo_payment_id)
    WHERE id = p_payment_id
    RETURNING order_id INTO v_order_id;

    IF v_order_id IS NULL THEN
        RAISE EXCEPTION 'Payment id % not found', p_payment_id;
    END IF;

    IF p_status = 'paid' THEN
        UPDATE public.orders
        SET order_status = 'completed'
        WHERE id = v_order_id
          AND order_status IS DISTINCT FROM 'completed';
    END IF;
END;
$func$;
```

You'll also need the `payments` table itself — see `find . -name "*.sql"` in
this repo, or ask the team for the current migration file if it's not yet
tracked in version control alongside the code.

### 5. PayMongo webhook setup

1. PayMongo Dashboard (test mode) → Developers → Webhooks → Create Webhook
2. URL: `https://your-deployed-url.onrender.com/api/payments/webhook`
   (must be a real, publicly reachable URL — cannot point at localhost)
3. Subscribe to events: `source.chargeable`, `payment.paid`, `payment.failed`
4. Copy the generated signing secret (`whsec_...`) into `PAYMONGO_WEBHOOK_SECRET`
   in your deployment's environment variables

### 6. Run the server

```bash
npm run dev     # with auto-reload (nodemon)
npm start       # plain node
```

Server starts on `http://localhost:4000` (or your configured `PORT`).
Check it's alive: `GET http://localhost:4000/health` → `{"status":"ok"}`.

Note: the payment webhook cannot be tested against `localhost` — PayMongo
needs a real public URL to call. Test the webhook flow against the deployed
Render URL, or use a tunneling tool (ngrok, etc.) if you need to test webhook
changes before deploying.

## Testing the API manually

Log in to get a token:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"yourpassword"}'
```

Use the returned `access_token` on protected routes:

```bash
curl http://localhost:4000/api/products \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

Refresh an expired token (tokens last ~1 hour):

```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}'
```

Initiate a test GCash payment (against the deployed URL, so the webhook can
actually reach it):

```bash
curl -X POST https://cuccu-pos-api.onrender.com/api/payments/initiate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1, "payment_method": "gcash", "amount": 150}'
```

Open the returned `checkout_url` in a browser to walk through PayMongo's
test-mode authorization page, then poll:

```bash
curl https://cuccu-pos-api.onrender.com/api/payments/1 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Automated tests

Tests run against your **real** Supabase project (not mocks), because RLS is
the actual thing being tested. They create/clean up their own test data.

1. Create `.env.test` (never commit this) with test credentials:
   ```
   TEST_OWNER_EMAIL=owner@example.com
   TEST_OWNER_PASSWORD=yourpassword
   TEST_CASHIER_EMAIL=cashier@example.com
   TEST_CASHIER_PASSWORD=yourpassword
   PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```
2. Run:
   ```bash
   npm test
   ```

Test files use `.mjs` extension and `import` syntax — this is required by
Vitest's internals, even though the rest of the project is CommonJS
(`require`/`module.exports`). Don't rename them back to `.js`.

The payments test suite can verify signature validation and real PayMongo
Source creation automatically, but **cannot** automate a full `paid` status
transition — that step requires a human to authorize a payment in a real
browser session, which is not something a test runner can do. That last leg
of the flow needs manual verification (see "Testing the API manually" above).

## API reference

All routes except `/health`, `/api/auth/login`, `/api/auth/refresh`, and
`/api/payments/webhook` require `Authorization: Bearer <token>`.

| Resource | Base route | Read access | Write access |
|---|---|---|---|
| Auth | `/api/auth` | — | login, refresh, logout, me |
| Categories | `/api/categories` | any authenticated user | owner only |
| Products | `/api/products` | any authenticated user | owner only |
| Product Variants | `/api/product-variants` | any authenticated user | owner only |
| Addons | `/api/addons` | any authenticated user | owner only |
| Ingredients | `/api/ingredients` | any authenticated user | owner only |
| Recipes | `/api/recipes` | any authenticated user | owner only |
| Inventory Transactions | `/api/inventory-transactions` | owner only | owner only |
| Orders | `/api/orders` | owner, cashier | owner, cashier (delete: owner only) |
| Order Items | `/api/order-items` | owner, cashier | owner, cashier (delete: owner only) |
| Order Item Addons | `/api/order-item-addons` | owner, cashier | owner, cashier (delete: owner only) |
| Profiles | `/api/profiles` | own profile (cashier), all (owner) | owner only |
| Payments | `/api/payments` | owner, cashier | initiate: owner, cashier · webhook: PayMongo only (HMAC-verified, no user auth) |

Standard CRUD verbs apply per resource: `GET /`, `GET /:id`, `POST /`,
`PATCH /:id`, `DELETE /:id` (except where noted above, e.g. profiles has
no `POST`, inventory-transactions has no `PATCH`, payments uses
`POST /initiate` and `GET /:orderId` instead of the standard shape).

Most list endpoints support filtering, e.g.:
- `GET /api/products?category_id=1`
- `GET /api/product-variants?product_id=4`
- `GET /api/ingredients?low_stock=true`
- `GET /api/orders?status=completed`

For full request/response shapes on every endpoint, including the complete
GCash/Maya payment flow, see `FRONTEND_GUIDE.md`.

## Important behavior notes

- **Inventory deduction is automatic.** Your database already has a trigger
  (`deduct_inventory_for_completed_order`) that deducts ingredient stock via
  the `recipes` mapping whenever an order's `order_status` is updated to
  `completed`. The API does not duplicate this — it just does a normal
  `PATCH /api/orders/:id` with `{"order_status": "completed"}` (for cash),
  or the payment webhook triggers it automatically (for GCash/Maya).
- **`profile_id` on orders is always set server-side** from the logged-in
  user's own ID — never accepted from the request body. This prevents a
  cashier from creating an order attributed to someone else.
- **Inventory transactions have no update endpoint.** They're a ledger of
  history; corrections should be new `adjustment` entries, not edits to
  past records.
- **Profiles have no create endpoint.** New profiles are only created via
  Supabase Auth signup (the `handle_new_user` trigger handles this
  automatically, bypassing RLS via `SECURITY DEFINER`).
- **GCash/Maya orders should never be manually marked `completed`.** Only
  cash orders are completed via a direct `PATCH` from the frontend/cashier.
  Digital wallet orders are completed automatically, only after PayMongo
  confirms the payment via webhook — this is what makes payment
  verification real rather than a manual SMS-check workaround.
- **PayMongo amounts are in centavos**, but this API's own request/response
  bodies always use plain peso amounts (e.g. `150` for ₱150.00) — the
  centavo conversion happens internally in `src/config/paymongo.js` and is
  never something the frontend needs to handle.

## Project structure

```
src/
├── config/
│   ├── supabase.js            # anon client (login/refresh) + per-user client factory
│   └── paymongo.js            # PayMongo REST API wrapper (createSource, createPayment)
├── middleware/
│   ├── auth.js                 # verifies JWT via JWKS, attaches req.user/role/supabase
│   ├── requireRole.js          # fast-fail role guard (real enforcement is RLS)
│   ├── validate.js             # zod request validation
│   └── errorHandler.js         # centralized error formatting (incl. RLS/Postgres errors)
├── routes/                     # one file per resource, incl. payments.routes.js
├── controllers/                # one file per resource, incl. payments.controller.js
├── schemas/                    # zod schemas per resource
├── app.js                      # Express app + middleware wiring (no listen())
└── server.js                   # entrypoint (calls app.listen)
tests/
├── auth.test.mjs
├── products.test.mjs
└── payments.test.mjs
```

Note on `app.js`: the PayMongo webhook route needs the **raw, unparsed**
request body to verify its HMAC signature — `express.json()` would otherwise
consume and transform the body stream before the signature check ever runs.
`app.js` registers a raw-body capture middleware scoped specifically to
`/api/payments/webhook`, positioned *before* the global `express.json()`
call, so every other route still gets normal JSON parsing untouched.

## Security practices applied

- Passwords never touch this codebase — handled entirely by Supabase Auth
  (bcrypt-hashed under the hood).
- JWT signature verification via JWKS (not a shared secret you'd have to
  protect separately).
- Rate limiting: general API limiter + a stricter one on `/api/auth/login`
  to blunt brute-force attempts.
- `helmet` for standard security headers.
- CORS allowlist — fails closed if misconfigured.
- All request bodies validated with `zod` before hitting the database.
- No SQL injection surface — all queries go through the Supabase client's
  query builder, never raw string-interpolated SQL.
- Real authorization boundary is Postgres RLS, not application code —
  meaning even a bug in Express middleware can't leak data across roles.
- The payments webhook is secured by HMAC-SHA256 signature verification
  (timing-safe comparison), matching PayMongo's documented security model.
  Signature verification is hardened to fail closed (return `false`) on any
  malformed header or crypto error, rather than throwing an unhandled
  exception that could otherwise surface as an unexpected 500.
- Secrets (`SUPABASE_PUBLISHABLE_KEY`, `PAYMONGO_SECRET_KEY`,
  `PAYMONGO_WEBHOOK_SECRET`, etc.) loaded from environment variables only,
  never hardcoded. `.env` and `.env.test` are gitignored.
- No Supabase secret/service-role key anywhere in the codebase — including
  the payments webhook, which uses narrowly-scoped `SECURITY DEFINER`
  Postgres functions instead (see "The one exception" above).

## Deployment notes (free-tier friendly)

- This API has no persistent local state — safe to deploy on any free-tier
  Node host (Render, Railway, Fly.io free tier). Currently deployed on
  Render's free tier.
- Set the same environment variables from `.env` in your host's dashboard,
  including the PayMongo keys.
- Update `ALLOWED_ORIGINS` to your deployed frontend's real URL.
- Update the PayMongo webhook URL in PayMongo's dashboard if you ever
  redeploy to a different host/URL — it's a fixed URL registered on
  PayMongo's side, not something the API reads from its own environment.
- Supabase's free tier covers the database + auth; PayMongo's test mode is
  free and doesn't process real money. No paid service is required for this
  API to function in development/demo form.
- Render's free tier spins down after ~15 minutes of inactivity; the first
  request after idling takes 30-50 seconds (cold start). This also means a
  webhook arriving while the service is asleep will be slightly delayed
  rather than dropped — PayMongo's own retry behavior covers this.