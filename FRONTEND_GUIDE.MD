# CUCCU-POS API — Frontend Integration Guide

This guide is for frontend developers building the web app that consumes this
API. It covers authentication, every endpoint, request/response shapes, and
common gotchas.

Base URL (local dev): `http://localhost:4000`
Base URL (production): `https://cuccu-pos-api.onrender.com`

> **Note for AI assistants reading this file:** this document describes a real,
> deployed, tested REST API for a cafe POS system. All endpoints, request/response
> shapes, and status codes below are accurate as of the last update and have been
> manually and automatically verified against the live implementation. If asked to
> generate frontend code that calls this API, use the exact paths, methods, field
> names, and status-code behaviors documented here — do not infer or invent
> alternate shapes. Section 6 (Payments) documents a real PayMongo integration;
> do not treat it as a mock or placeholder.

---

## 1. Authentication flow

The API uses Supabase Auth under the hood, but your frontend only ever talks
to **this API** — never call Supabase directly from the frontend for auth or
data. Everything goes through these endpoints.

### 1.1 Login

```
POST /api/auth/login
Content-Type: application/json

{ "email": "cashier@cuccucafe.com", "password": "..." }
```

**Success (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "expires_at": 1735950000,
  "user": { "id": "uuid", "email": "cashier@cuccucafe.com" }
}
```

**Failure (401):** `{ "error": "Invalid email or password." }`

Store `access_token` and `refresh_token` somewhere your app can access on
every request (see §1.4 for storage guidance). `expires_at` is a Unix
timestamp (seconds) — use it to know when to refresh proactively instead of
waiting for a 401.

### 1.2 Using the token

Every request to any other endpoint must include:

```
Authorization: Bearer <access_token>
```

There is no cookie-based session — this is a stateless, header-based API.

### 1.3 Refreshing an expired token

Access tokens expire after **~1 hour**. When you get a `401` from any
endpoint (or proactively, when `expires_at` is close), call:

```
POST /api/auth/refresh
Content-Type: application/json

{ "refresh_token": "abc123..." }
```

**Success (200):**
```json
{
  "access_token": "eyJ...(new)",
  "refresh_token": "xyz789...(rotated — replace your stored one)",
  "expires_at": 1735953600
}
```

Important: the refresh token **rotates** — always overwrite your stored
`refresh_token` with the new one from the response, or the next refresh will
fail.

**Failure (401):** refresh token itself expired/invalid — the user must log
in again from scratch.

**Recommended pattern:** wrap your HTTP client so any `401` response
automatically attempts one refresh-and-retry before giving up and redirecting
to login. Example (framework-agnostic pseudocode):

```js
async function apiFetch(path, options = {}) {
  let res = await fetch(`${BASE_URL}${path}`, withAuthHeader(options));

  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      res = await fetch(`${BASE_URL}${path}`, withAuthHeader(options));
    } else {
      redirectToLogin();
      return;
    }
  }

  return res;
}
```

### 1.4 Where to store tokens

This is a frontend architecture decision, not something the API dictates, but
guidance:
- **Do not** store tokens in `localStorage` if you can avoid it (XSS risk).
- In-memory storage (a JS variable / state store) plus the refresh token in
  an `httpOnly` cookie set by your own frontend server is the safer pattern
  if your stack supports it.
- If you're a pure SPA with no backend of your own, `sessionStorage` is a
  reasonable middle ground over `localStorage` (cleared on tab close).

### 1.5 Logout

```
POST /api/auth/logout
Authorization: Bearer <access_token>
```

Invalidates the session server-side. Clear your locally stored tokens
regardless of the response.

### 1.6 Getting the current user + role

```
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Success (200):**
```json
{
  "user": { "id": "uuid", "email": "owner@cuccucafe.com" },
  "profile": { "id": "uuid", "full_name": "Reezia Calayag", "role": "owner" }
}
```

Call this right after login to know whether to render the **Owner Dashboard**
or the **Cashier POS Interface**. `profile.role` is either `"owner"` or
`"cashier"` — there are no other values.

---

## 2. How permissions work (read this before building UI)

Two roles exist: `owner` and `cashier`. Permissions are enforced **on the
server** (both in the API and, underneath it, in the database). The frontend
should:

1. Use `profile.role` to decide what UI to show (don't show a "Delete
   Product" button to a cashier — but this is a UX nicety, not security).
2. **Always handle `403 Forbidden` responses gracefully**, even if your UI
   tries to prevent the action — a stale UI state, a role change mid-session,
   or a direct API call during testing can all trigger this.
3. Never assume a `200`/`201` will always come back for a given role/action
   combo — check the table in §4 before wiring up a button.

A `403` response always looks like:
```json
{ "error": "Forbidden. This action requires one of: owner." }
```

---

## 3. Standard response shapes

**Lists:** `{ "data": [ {...}, {...} ] }`

**Single resource:** `{ "data": { ... } }`

**Validation error (400):**
```json
{
  "error": "Validation failed.",
  "details": [
    { "path": "name", "message": "Name is required" }
  ]
}
```
Use `details[].path` to highlight the specific form field that failed.

**Not found (404):** `{ "error": "Resource not found." }`

**Conflict (409)** — e.g. duplicate name, or a foreign key constraint hit:
```json
{ "error": "A record with this value already exists." }
```

**Server error (500):** `{ "error": "Internal server error." }` — no
internal details are ever leaked here; if you need to debug, check with the
backend team.

**Successful delete (204):** empty body, no JSON. Check `res.status === 204`,
don't try to parse a body.

---

## 4. Endpoint reference

Legend: 🟢 any authenticated user · 🔵 owner + cashier · 🟠 owner only · ⚪ no auth (PayMongo server-to-server only)

### Categories — `/api/categories`
| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/` | 🟢 | — |
| GET | `/:id` | 🟢 | — |
| POST | `/` | 🟠 | `{ name, description? }` |
| PATCH | `/:id` | 🟠 | any subset of create fields |
| DELETE | `/:id` | 🟠 | — |

### Products — `/api/products`
| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🟢 | `?category_id=1` (optional filter) |
| GET | `/:id` | 🟢 | — |
| POST | `/` | 🟠 | `{ category_id, name, description?, is_available? }` |
| PATCH | `/:id` | 🟠 | any subset |
| DELETE | `/:id` | 🟠 | — |

### Product Variants — `/api/product-variants`
This is where **price, size, and temperature** live — not on the product
itself. A "Cafe Latte" product has multiple variants (Hot 12oz, Cold 16oz,
etc.), each with its own price. Always fetch variants to display prices.

| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🟢 | `?product_id=1` (optional filter — use this to load a single product's variants) |
| GET | `/:id` | 🟢 | — |
| POST | `/` | 🟠 | `{ product_id, variant_name, size?, temperature?, price, is_available? }` |
| PATCH | `/:id` | 🟠 | any subset |
| DELETE | `/:id` | 🟠 | — |

### Addons — `/api/addons`
| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/` | 🟢 | — |
| GET | `/:id` | 🟢 | — |
| POST | `/` | 🟠 | `{ name, price, is_available? }` |
| PATCH | `/:id` | 🟠 | any subset |
| DELETE | `/:id` | 🟠 | — |

### Ingredients — `/api/ingredients`
| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🟢 | `?low_stock=true` (returns only ingredients at/below reorder level — good for a dashboard alert widget) |
| GET | `/:id` | 🟢 | — |
| POST | `/` | 🟠 | `{ name, unit, stock_quantity?, reorder_level?, is_available? }` |
| PATCH | `/:id` | 🟠 | any subset |
| DELETE | `/:id` | 🟠 | — |

### Recipes — `/api/recipes`
Maps a product variant to the ingredients it consumes. Mostly relevant for
the Owner's menu-management screens, not the cashier POS flow.

| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🟢 | `?product_variant_id=4` (optional filter) |
| GET | `/:id` | 🟢 | — |
| POST | `/` | 🟠 | `{ product_variant_id, ingredient_id, quantity }` |
| PATCH | `/:id` | 🟠 | `{ quantity }` only |
| DELETE | `/:id` | 🟠 | — |

### Inventory Transactions — `/api/inventory-transactions`
🟠 **Owner-only for reads too** — cashiers get 403 even on GET. This is a
back-office/owner-dashboard-only resource. Also: **no PATCH endpoint** —
it's an append-only ledger; corrections are new entries, not edits.

| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🟠 | `?ingredient_id=1` (optional filter) |
| GET | `/:id` | 🟠 | — |
| POST | `/` | 🟠 | `{ ingredient_id, transaction_type, quantity, reference_type?, reference_id?, notes? }` |
| DELETE | `/:id` | 🟠 | — |

`transaction_type` must be one of: `"stock_in"`, `"stock_out"`, `"adjustment"`.

**Note:** you generally won't need to POST here manually for sales — see §5,
inventory deduction on completed orders is automatic.

### Orders — `/api/orders`
🔵 Both roles can create/view/update. Only owners can delete.

| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🔵 | `?status=completed` (optional filter: `pending`\|`preparing`\|`completed`\|`cancelled`) |
| GET | `/:id` | 🔵 | — |
| POST | `/` | 🔵 | `{ payment_method, order_status?, subtotal?, discount_amount?, total_amount? }` |
| PATCH | `/:id` | 🔵 | any subset |
| DELETE | `/:id` | 🟠 | — |

`payment_method` must be one of: `"cash"`, `"gcash"`, `"maya"`.
`order_status` defaults to `"pending"` if omitted.

**Do not send `profile_id`** in the POST body — it's set automatically from
your logged-in token, and any value you send will be ignored.

### Order Items — `/api/order-items`
| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🔵 | `?order_id=2` (use this to load all items for one order) |
| GET | `/:id` | 🔵 | — |
| POST | `/` | 🔵 | `{ order_id, product_variant_id, quantity?, unit_price, subtotal }` |
| PATCH | `/:id` | 🔵 | `{ quantity?, unit_price?, subtotal? }` |
| DELETE | `/:id` | 🟠 | — |

Note: `unit_price` and `subtotal` are **not calculated server-side** — the
frontend must compute and send them (pull `price` from the product variant
you already fetched, multiply by `quantity`).

### Order Item Addons — `/api/order-item-addons`
| Method | Path | Access | Body / Query |
|---|---|---|---|
| GET | `/` | 🔵 | `?order_item_id=3` |
| GET | `/:id` | 🔵 | — |
| POST | `/` | 🔵 | `{ order_item_id, addon_id, quantity?, unit_price }` |
| PATCH | `/:id` | 🔵 | `{ quantity?, unit_price? }` |
| DELETE | `/:id` | 🟠 | — |

A given `(order_item_id, addon_id)` pair can only exist once — adding the
same addon twice to the same item returns a `409`. If the cashier wants 2x
Espresso Shot, send `quantity: 2` in one call, don't call twice.

### Profiles — `/api/profiles`
🔵 read (RLS auto-filters: cashiers only ever see their own row, owners see
all — no query param needed, just call the same endpoint). 🟠 write.
**No POST** — profiles are created automatically on signup, not via this API.

| Method | Path | Access | Body |
|---|---|---|---|
| GET | `/` | 🔵 (filtered by role automatically) | — |
| GET | `/:id` | 🔵 | — |
| PATCH | `/:id` | 🟠 | `{ full_name?, role? }` |

### Payments (PayMongo) — `/api/payments`
Real integration with PayMongo for GCash and Maya. See §6 for the full flow —
this is not a mock or a manual-verification shortcut. Cards and cash are not
routed through this resource: cash needs no online verification, and card
payments aren't part of this system's scope.

| Method | Path | Access | Body / Query |
|---|---|---|---|
| POST | `/initiate` | 🔵 | `{ order_id, payment_method, amount }` — see §6.1 |
| GET | `/:orderId` | 🔵 | Returns the most recent payment attempt for that order |
| POST | `/webhook` | ⚪ | **Never call this from the frontend.** PayMongo calls it directly. Included here only for completeness. |

---

## 5. Building the checkout / order flow (important sequencing)

Orders are three related tables. **Insert in this exact order** — each step
needs the ID from the previous one:

1. **Create the order first:**
   ```
   POST /api/orders
   { "payment_method": "cash", "subtotal": 220, "total_amount": 220 }
   ```
   → returns `data.id`, call it `orderId`.

2. **For each product the customer ordered, create an order item:**
   ```
   POST /api/order-items
   { "order_id": orderId, "product_variant_id": 4, "quantity": 1, "unit_price": 120, "subtotal": 120 }
   ```
   → returns `data.id`, call it `orderItemId`.

3. **If that item has add-ons, create order item addons:**
   ```
   POST /api/order-item-addons
   { "order_item_id": orderItemId, "addon_id": 1, "quantity": 1, "unit_price": 40 }
   ```

4. **Mark the order completed — how depends on the payment method:**

   - **Cash:** the cashier confirms payment was physically received, so your
     frontend calls this directly:
     ```
     PATCH /api/orders/:orderId
     { "order_status": "completed" }
     ```

   - **GCash or Maya:** do **not** call `PATCH /api/orders/:orderId` yourself.
     Instead, follow the payment flow in §6 — the order is marked `completed`
     **automatically** by the backend once PayMongo confirms the customer
     actually paid. Manually completing a GCash/Maya order before payment is
     confirmed would mark it paid when it might not be.

### What happens automatically at step 4 — read this

The moment `order_status` becomes `"completed"` (whether you set it directly
for cash, or the backend sets it automatically after a confirmed GCash/Maya
payment), a **database trigger** automatically deducts the right amount of
every ingredient from `ingredients.stock_quantity`, based on the `recipes`
mapping for each `product_variant_id` in that order, and logs it in
`inventory_transactions`. **Your frontend does not need to call the
inventory-transactions endpoint for sales** — only use that endpoint for
manual stock-in (deliveries) or manual adjustments (spoilage, counts).

Practical implication: don't let the cashier mark an order `completed` and
then immediately re-open/edit it expecting inventory to "undo" — there's no
automatic reversal. Cancel/refund handling (if needed) would need a manual
`adjustment` entry, and should probably be an owner-only action in your UI.

---

## 6. GCash / Maya payments (PayMongo integration)

This is a **real, working integration** with PayMongo — not a manual
SMS-checking shortcut, not a mock. When a customer pays via GCash or Maya,
your frontend triggers a real payment authorization flow, and the backend
automatically confirms payment and completes the order once PayMongo
verifies the money actually moved. No cashier ever needs to check an SMS
or manually confirm a digital payment.

### 6.1 The full flow, step by step

**Step 1 — Create the order first**, same as any other order (§5, step 1),
with `payment_method` set to `"gcash"` or `"maya"`:
```
POST /api/orders
{ "payment_method": "gcash", "subtotal": 150, "total_amount": 150 }
```
→ note the returned `data.id` as `orderId`.

**Step 2 — Add order items / addons**, same as §5 steps 2–3. Do this before
initiating payment, so the order total is finalized first.

**Step 3 — Initiate the payment:**
```
POST /api/payments/initiate
Authorization: Bearer <token>
Content-Type: application/json

{ "order_id": orderId, "payment_method": "gcash", "amount": 150 }
```

- `payment_method` must be exactly `"gcash"` or `"maya"` (not `"paymaya"` —
  that translation happens server-side).
- `amount` is in **pesos** (e.g. `150` for ₱150.00), as a plain number, not
  centavos. The backend converts to centavos internally for PayMongo.

**Success (201):**
```json
{
  "data": {
    "id": 1,
    "order_id": 3,
    "provider": "paymongo",
    "payment_method": "gcash",
    "paymongo_source_id": "src_8P2XUdw8f4XSztRskFhddHyC",
    "paymongo_payment_id": null,
    "status": "pending",
    "amount": 150,
    "checkout_url": "https://secure-authentication.paymongo.com/sources?id=src_...",
    "created_at": "2026-09-05T09:39:04.47372+00:00"
  }
}
```

**Step 4 — Show `checkout_url` to the customer.** Two common UI patterns:
- Redirect the browser/webview to `checkout_url` directly (simplest).
- Render `checkout_url` as a QR code for the customer to scan with their
  own phone, while the cashier's screen stays on the order (better for an
  in-person counter flow, since the cashier's device doesn't need to leave
  the POS screen).

The customer authorizes the payment on PayMongo's hosted page, in their own
GCash/Maya app or browser session — **your frontend has no direct
involvement in the authorization step itself.**

**Step 5 — Poll for payment status** while waiting for the customer to
finish authorizing:
```
GET /api/payments/:orderId
Authorization: Bearer <token>
```
Poll every 2–3 seconds. `status` will progress through:
`"pending"` → `"chargeable"` → `"paid"` (or `"failed"` if the customer
cancels or the payment is declined).

**Success response, e.g. mid-flow:**
```json
{
  "data": {
    "id": 1,
    "status": "chargeable",
    "payment_method": "gcash",
    "amount": 150,
    "checkout_url": "https://secure-authentication.paymongo.com/sources?id=src_...",
    "created_at": "2026-09-05T09:39:04.47372+00:00"
  }
}
```

**Step 6 — Once `status` is `"paid"`, stop polling and refresh the order:**
```
GET /api/orders/:orderId
```
`order_status` will already be `"completed"` — the backend did this for you
automatically, right after PayMongo confirmed the payment. Ingredient
deduction has also already happened (see §5's inventory-deduction note).
No further action is needed from the frontend.

**If `status` becomes `"failed"`:** show the customer/cashier a clear retry
option. Call `POST /api/payments/initiate` again with the same `order_id` to
generate a new `checkout_url` — a failed payment attempt does not lock the
order, and the order itself stays in whatever status it was before (it will
NOT be `"completed"`).

### 6.2 What your frontend must NOT do

- **Never call `POST /api/payments/webhook`.** That route exists only for
  PayMongo's servers to call directly. It requires a cryptographic signature
  your frontend cannot produce, and calling it will always fail
  authentication from a browser context anyway.
- **Never manually `PATCH` an order to `"completed"` for a GCash/Maya
  order.** Let the backend do this after real payment confirmation. Setting
  it yourself would mark an order paid before money has actually moved.
- **Don't assume payment is instant.** The customer needs time to open their
  app and approve — design your UI around polling/waiting (a spinner, a
  "waiting for customer to approve on their phone" message), not an
  immediate result.

### 6.3 Payment status reference

| Status | Meaning | What the frontend should show |
|---|---|---|
| `pending` | Payment created, customer hasn't authorized yet | "Waiting for customer to approve payment" |
| `chargeable` | Customer authorized; backend is capturing the charge | Same waiting state — this is usually momentary |
| `paid` | Payment confirmed and captured. Order auto-completed. | Success screen; stop polling |
| `failed` | Customer cancelled, or PayMongo declined the charge | Show retry option (re-call `/initiate`) |

### 6.4 Cash payments need none of this

If `payment_method` is `"cash"`, skip this entire section — go straight to
`PATCH /api/orders/:orderId { "order_status": "completed" }` once the
cashier confirms they've physically received payment. The `/api/payments/*`
endpoints are only relevant for `"gcash"` and `"maya"`.

---

## 7. Common pitfalls

- **"It works for owner but 403s for cashier" is often correct, not a bug.**
  Check the access column in §4 before assuming something's broken.
- **Token expiry mid-shift.** A cashier's shift can easily outlast a 1-hour
  token. Implement the refresh-and-retry pattern from §1.3 — don't make
  cashiers re-login mid-order.
- **`unit_price`/`subtotal` aren't server-calculated.** If your totals look
  wrong, check your frontend math, not the API.
- **Duplicate addon on the same order item** → `409`, not a silent
  overwrite. Increment `quantity` instead of re-posting.
- **`DELETE` returns no body.** Don't call `res.json()` on a 204 response —
  it'll throw on an empty body in most HTTP clients.
- **Low-stock filter is a computed comparison**, not a raw column — you can
  only get it via `?low_stock=true`, there's no way to sort/filter by "how
  far below reorder level" beyond that boolean.
- **GCash/Maya orders don't complete instantly.** If you're testing and an
  order stays `"pending"` after you thought you paid, check the payment
  `status` first (§6.3) before assuming the API is broken — the customer
  may not have finished authorizing yet.
- **Don't poll `/api/payments/:orderId` too aggressively.** Every request
  counts against the general rate limit. Poll every 2–3 seconds, not in a
  tight loop, and stop polling once you get `"paid"` or `"failed"`.
- **A `payment.failed` status doesn't mean you should retry the same
  `checkout_url`.** It's dead once failed — call `/api/payments/initiate`
  again to get a fresh one.

---

## 8. Questions / issues

If an endpoint doesn't behave as documented here, check with the backend
team before assuming frontend bug — this doc should be kept in sync with
`src/routes/` as the source of truth.