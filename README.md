# CUCCU-POS API

A REST API for Cuccu Cafe's POS/inventory system, built on Express and Supabase
(Postgres + Auth). It sits on top of an existing Supabase project and schema —
this API does not manage the database schema itself, only exposes it safely
over HTTP.

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
project.** Only the publishable key + per-user JWTs. That's intentional.

## Tech stack

- Node.js + Express
- Supabase (`@supabase/supabase-js`) — Postgres + Auth
- `jose` — verifies user JWTs locally against Supabase's JWKS endpoint
  (no extra round-trip to Supabase per request)
- `zod` — request body validation
- `helmet`, `cors`, `express-rate-limit` — security middleware
- `vitest` + `supertest` — automated integration tests

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase project's values
(Supabase Dashboard → Project Settings → API):

```bash
cp .env.example .env
```

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here
SUPABASE_JWKS_URL=https://your-project-ref.supabase.co/auth/v1/.well-known/jwks.json
PORT=4000
ALLOWED_ORIGINS=http://localhost:5173
```

`ALLOWED_ORIGINS` is a comma-separated list of frontend origins allowed by CORS.
If left empty, CORS blocks all cross-origin requests (fails closed, not open).

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

### 4. Run the server

```bash
npm run dev     # with auto-reload (nodemon)
npm start       # plain node
```

Server starts on `http://localhost:4000` (or your configured `PORT`).
Check it's alive: `GET http://localhost:4000/health` → `{"status":"ok"}`.

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

## Automated tests

Tests run against your **real** Supabase project (not mocks), because RLS is
the actual thing being tested. They create/clean up their own test data.

1. Create `.env.test` (never commit this) with test credentials:
   ```
   TEST_OWNER_EMAIL=owner@example.com
   TEST_OWNER_PASSWORD=yourpassword
   TEST_CASHIER_EMAIL=cashier@example.com
   TEST_CASHIER_PASSWORD=yourpassword
   ```
2. Run:
   ```bash
   npm test
   ```

Test files use `.mjs` extension and `import` syntax — this is required by
Vitest's internals, even though the rest of the project is CommonJS
(`require`/`module.exports`). Don't rename them back to `.js`.

## API reference

All routes except `/health`, `/api/auth/login`, and `/api/auth/refresh`
require `Authorization: Bearer <token>`.

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

Standard CRUD verbs apply per resource: `GET /`, `GET /:id`, `POST /`,
`PATCH /:id`, `DELETE /:id` (except where noted above, e.g. profiles has
no `POST`, inventory-transactions has no `PATCH`).

Most list endpoints support filtering, e.g.:
- `GET /api/products?category_id=1`
- `GET /api/product-variants?product_id=4`
- `GET /api/ingredients?low_stock=true`
- `GET /api/orders?status=completed`

## Important behavior notes

- **Inventory deduction is automatic.** Your database already has a trigger
  (`deduct_inventory_for_completed_order`) that deducts ingredient stock via
  the `recipes` mapping whenever an order's `order_status` is updated to
  `completed`. The API does not duplicate this — it just does a normal
  `PATCH /api/orders/:id` with `{"order_status": "completed"}`.
- **`profile_id` on orders is always set server-side** from the logged-in
  user's own ID — never accepted from the request body. This prevents a
  cashier from creating an order attributed to someone else.
- **Inventory transactions have no update endpoint.** They're a ledger of
  history; corrections should be new `adjustment` entries, not edits to
  past records.
- **Profiles have no create endpoint.** New profiles are only created via
  Supabase Auth signup (the `handle_new_user` trigger handles this
  automatically, bypassing RLS via `SECURITY DEFINER`).

## Project structure

```
src/
├── config/supabase.js       # anon client (login/refresh) + per-user client factory
├── middleware/
│   ├── auth.js               # verifies JWT via JWKS, attaches req.user/role/supabase
│   ├── requireRole.js        # fast-fail role guard (real enforcement is RLS)
│   ├── validate.js           # zod request validation
│   └── errorHandler.js       # centralized error formatting (incl. RLS/Postgres errors)
├── routes/                   # one file per resource
├── controllers/              # one file per resource
├── schemas/                  # zod schemas per resource
├── app.js                    # Express app + middleware wiring (no listen())
└── server.js                 # entrypoint (calls app.listen)
tests/
├── auth.test.mjs
└── products.test.mjs
```

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
- Secrets (`SUPABASE_PUBLISHABLE_KEY`, etc.) loaded from environment
  variables only, never hardcoded. `.env` and `.env.test` are gitignored.

## Deployment notes (free-tier friendly)

- This API has no persistent local state — safe to deploy on any free-tier
  Node host (Render, Railway, Fly.io free tier).
- Set the same environment variables from `.env` in your host's dashboard.
- Update `ALLOWED_ORIGINS` to your deployed frontend's real URL.
- Supabase's free tier covers the database + auth; no additional paid
  service is required for this API to function.