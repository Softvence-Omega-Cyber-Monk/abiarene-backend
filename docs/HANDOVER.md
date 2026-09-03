# AbiArene Backend Handover

## 1. Project at a glance

AbiArene is a multi-tenant POS SaaS backend. One shared PostgreSQL database stores every business (tenant), while tenant-scoped records are isolated by `tenantId`.

- Stack: NestJS 11, TypeScript, Prisma 6, PostgreSQL, JWT, Socket.IO.
- API prefix: `/api`.
- Interactive API contract: `/api/docs`.
- Auth: JWT bearer token. The token carries `sub`, `role`, `tenantId` for staff, and `tokenVersion`.
- Time: database timestamps are UTC. The tenant overview accepts an IANA timezone query to calculate local business-day reporting.

Use Swagger as the source of truth for every DTO and response body. This document records ownership, business flows, state transitions, and deployment details.

## 2. Local run

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm start:dev
```

Swagger is available at `http://localhost:3000/api/docs` when `PORT=3000`.

Useful checks:

```bash
pnpm build
pnpm test
pnpm prisma:generate
```

Never commit `.env`. Rotate all currently used credentials before production handover, especially database, JWT, Stripe, Paystack, Cloudinary, SMTP, and cloud-provider keys.

## 3. Environment variables

Required application configuration:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port. Docker defaults to `3000`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | JWT signing and Socket.IO token verification. |
| `ALLOWED_ORIGINS` | Optional comma-separated CORS origins. |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary upload configuration. |
| `CLOUDINARY_API_KEY` | Cloudinary upload configuration. |
| `CLOUDINARY_API_SECRET` | Cloudinary upload configuration. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe subscription checkout and webhook verification. |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | Paystack subscription checkout. |
| `PAYSTACK_WEBHOOK_SECRET` | Configure when Paystack webhook verification is enabled. |
| `MTN_*` / Orange provider credentials | Required only when those provider integrations are configured. |

Do not use Docker service names such as `redis` from a locally running backend unless that Docker network exists. For a host service use `127.0.0.1`; for a Compose service use the service name.

## 4. Authorization and tenant isolation

Global guards are registered in `src/app.module.ts` in this order:

1. `JwtAuthGuard`: blocks non-public requests without a valid JWT.
2. `TenantGuard`: requires a staff token to contain `tenantId`; admins bypass that requirement; supervisor tenant creation is explicitly allowed before a tenant exists.
3. `RolesGuard`: checks the `@Roles(...)` decorator on each route.

Roles in the system:

| Role | Main responsibility |
| --- | --- |
| `ADMIN` | Platform owner: plans, tenant oversight, admin-side user/table/item management, tenant vouchers, support replies. |
| `SUPERVISOR` | Creates and owns a tenant, manages staff and tenant configuration, subscriptions, reports, inventory approval. |
| `MANAGER` | Runs day-to-day business, staff/inventory/menu/table management, limited reports. |
| `SERVER` | Dine-in tables and orders. |
| `KITCHEN` | Kitchen board and ticket processing. |
| `CASHIER` | Direct orders, checkout, payment completion. |

Important rule: tenant-scoped service queries must always filter by `tenantId`. Do not add a route that fetches a tenant entity by its `id` alone for a staff user.

## 5. Core onboarding and subscription flow

```text
Supervisor registration
  -> POST /api/auth/register
  -> account has SUPERVISOR role but no tenant yet

Tenant setup
  -> POST /api/tenant/create
  -> supervisor selects industry, countryCode, currencyCode and subscriptionPriceId
  -> tenant is ACTIVE but subscription is PENDING
  -> optional 7-day free trial when startWithFreeTrial=true

Optional admin offer
  -> admin creates a voucher under that specific tenant
  -> POST /api/admin/tenants/:tenantId/subscription-vouchers
  -> voucher cannot be used by another tenant

Subscription checkout
  -> GET /api/tenant/subscription/me?currency=EUR (optional display preview)
  -> POST /api/tenant/subscription/pay
  -> choose provider, payment currency, optional voucherCode
  -> payment record is created with original amount/currency, discount and exchange rate snapshot
  -> Stripe webhook or provider status check marks payment COMPLETED
  -> tenant subscription becomes ACTIVE with start/end dates
```

Subscription model notes:

- Admin subscription prices are globally defined fixed plan types: `FREE`, `MONTHLY`, `YEARLY`.
- `SubscriptionPrice.amount` has its own base `currency`, normally USD.
- Tenant `currencyCode` is the business operating currency. `subscriptionCurrencyCode` records the subscribed/display currency context.
- Currency conversion is a checkout/display concern. Persist the original amount, converted amount, currency, and `exchangeRate` in `SubscriptionPayment` so historical payments remain auditable.
- `CFA` is a display label only. Send/store the ISO code `XAF` for Central African CFA franc.
- Percentage vouchers do not require currency conversion because the percentage applies before payment conversion.

Key subscription routes:

| Route | Who | Purpose |
| --- | --- | --- |
| `GET /api/admin/subscription-prices?currency=EUR` | Public | List plans; optionally return converted display values. |
| `POST/PATCH/DELETE /api/admin/subscription-prices` | Admin | Manage fixed subscription plans. |
| `GET /api/tenant/subscription/me?currency=EUR` | Supervisor, Manager | Current subscription and converted payment preview. |
| `POST /api/tenant/subscription/pay` | Supervisor, Manager | Start payment. |
| `GET /api/tenant/subscription/payments/:reference/status` | Supervisor, Manager | Poll provider payment status. |
| `POST /api/payments/webhooks/stripe` | Public Stripe endpoint | Verify and process Stripe payment event. |

## 6. Business operation flows

### A. Restaurant dine-in order

```text
Supervisor/Manager creates menu items and tables
  -> POST /api/items
  -> POST /api/tables
  -> PATCH /api/tables/menu (selects shared menu items)

Server/Manager/Cashier creates order for table
  -> POST /api/orders
  -> table becomes OCCUPIED

Server/Manager/Cashier sends order
  -> POST /api/orders/:id/send-to-kitchen
  -> order CONFIRMED -> PREPARING
  -> kitchen ticket ACTIVE is created

Kitchen marks ticket ready
  -> POST /api/tickets/:id/bump-to-ready
  -> ticket ACTIVE -> READY
  -> order PREPARING -> READY

Kitchen/Server/Manager/Supervisor/Cashier archives ticket
  -> POST /api/tickets/:id/force-archive
  -> ticket READY/ACTIVE -> ARCHIVED
  -> order -> COMPLETED

Cashier checks out table
  -> POST /api/tables/:tableId/cashier-checkout
  -> completed payment records are created
  -> completed table orders are paid
  -> table becomes AVAILABLE and served=false
```

### B. Cashier direct order, no table

Use this for counter sales, supershops, hardware stores, etc. Do not create a fake counter table.

```text
Cashier creates direct order
  -> POST /api/orders/cashier-direct (menu items), or
  -> POST /api/orders/cashier-direct-inventory (inventory products)
  -> orderType=DIRECT and tableId=null

Optional kitchen preparation
  -> POST /api/orders/:id/send-to-kitchen
  -> POST /api/tickets/:id/bump-to-ready
  -> POST /api/tickets/:id/force-archive

Cashier completes direct payment
  -> POST /api/orders/:id/cashier-direct-checkout
  -> creates payment, decrements inventory when applicable, order becomes COMPLETED
```

### C. Inventory deletion approval

```text
Supervisor deletes item
  -> DELETE /api/inventory/:id
  -> product is deleted directly

Manager deletes item
  -> DELETE /api/inventory/:id
  -> PENDING InventoryDeletionRequest is created; product remains visible

Supervisor approves or rejects
  -> POST /api/inventory/delete-requests/:requestId/approve
     product and related pending request are deleted
  -> POST /api/inventory/delete-requests/:requestId/reject
     product remains; request becomes REJECTED
```

`GET /api/inventory?search=...` searches product name or barcode. Pending deletion information should be shown by the client when returned by the inventory list response.

### D. Staff management

```text
Supervisor creates tenant
  -> supervisor account is attached to the new tenant

Supervisor/Manager creates staff
  -> POST /api/users
  -> roles may be enabled with PATCH /api/tenant/:tenantId/roles

Supervisor resets staff credentials
  -> PATCH /api/users/:id/reset-credentials
  -> targets Manager, Cashier, Server, Kitchen only

Admin resets supervisor credentials
  -> PATCH /api/users/tenant/:tenantId/:id/reset-supervisor-credentials
```

Staff PIN is optional in the schema. Any credential-reset flow updates `tokenVersion`; the client must discard its old token and log in again.

## 7. Reporting

Route: `GET /api/tenant/overview?range=daily&timezone=Africa/Douala`

Allowed ranges:

- Supervisor: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`.
- Manager: `daily`, `monthly` only.

The response contains selected-period `sales`, `transactions`, `activeVouchers`, lifetime `overallTotalSales`, graph-ready historical sales points, and tenant `currency`.

The optional `timezone` must be an IANA timezone, for example `Asia/Dhaka`, `Africa/Douala`, `Europe/Paris`, or `UTC`. The backend converts local period boundaries to UTC before querying. This prevents a local 00:00 sale from appearing on the previous/next day in the dashboard.

Other manager/supervisor report routes:

- `GET /api/tenant/daily-sales-history?days=7`
- `GET /api/tenant/total-transactions`
- `GET /api/tenant/active-discounts`

Admin dashboard supports an optional display-currency query: `GET /api/admin/dashboard?currency=EUR`.

## 8. Realtime notifications

Socket.IO namespace: `/notifications`.

Connection authentication: send the JWT in `auth.token` (preferred), `Authorization` header, or `token` query. The gateway validates token version and active account status before joining rooms.

```ts
io(`${apiBaseUrl}/notifications`, {
  auth: { token: accessToken },
});
```

Client events to listen for:

| Event | Meaning |
| --- | --- |
| `notification:new` | A notification was persisted and delivered to this account. |
| `notification:read` | One notification was marked read. |
| `notification:read-all` | All notifications were marked read. |
| `notifications:pong` | Reply to client `notifications:ping`. |

Notification types include `ORDER_SENT_TO_KITCHEN`, `ORDER_CANCELLED`, `ORDER_READY`, `ORDER_ARCHIVED`, `PAYMENT_COMPLETED`, `SUBSCRIPTION_PAID`, and `GENERIC`.

The current gateway does not emit separate `table-update` or `kitchen-ready` socket event names. Realtime UI updates should react to `notification:new` and refetch the relevant REST resource.

## 9. API module map

| Swagger tag / route base | Responsibility |
| --- | --- |
| `Auth` / `/api/auth` | Register supervisor, login, logout, public tenant and tenant-user lookup. |
| `Admin` / `/api/admin` | Dashboard, subscription prices, tenant-scoped subscription vouchers. |
| `Admin Tenant` / `/api/tenant/all` | Admin tenant listing and cross-tenant role lookup. |
| `Tenant Portal` / `/api/tenant` | Supervisor onboarding, current tenant, role enablement, reports, subscription. |
| `Users` / `/api/users` | Tenant staff and admin cross-tenant staff operations. |
| `Inventory` / `/api/inventory` | Products, stock alerts, search, deletion approvals. |
| `Items` / `/api/items` | Tenant menu item CRUD. Search accepts `search` for name/category. |
| `Tenant Tables` / `/api/tables` | Tables, shared menu, dine-in cashier checkout. |
| `Admin Tables` / `/api/tables/tenant/:tenantId` | Admin table operations for any tenant. |
| `Orders` / `/api/orders` | Dine-in/direct orders, kitchen handoff, direct checkout, history. |
| `Tickets` / `/api/tickets` | Kitchen board and ticket lifecycle. |
| `Payments` / `/api/payments` | Payment CRUD and subscription provider callbacks/webhooks. |
| `Discount` / `/api/discount` | Tenant discounts/vouchers used at checkout. |
| `Notifications` / `/api/notifications` | Persistent in-app notification inbox. |
| `Support` / `/api/support` | Supervisor-to-admin support ticket messages. |
| `Uploads` / `/api/uploads/image` | Cloudinary upload; admin and supervisor only. |

## 10. Data model and state values

Critical Prisma models:

- `Tenant`, `Role`, `User`, `Admin`
- `SubscriptionPrice`, `SubscriptionVoucher`, `SubscriptionPayment`
- `Product`, `StockLog`, `InventoryDeletionRequest`
- `Menu`, `MenuItem`, `MenuSelection`
- `Table`, `Order`, `OrderItem`, `Ticket`, `TicketItem`, `Payment`
- `Discount`, `SupportTicket`, `SupportMessage`, `Notification`

State values to preserve:

| Entity | Values |
| --- | --- |
| Tenant subscription | `PENDING`, `ACTIVE`, `EXPIRED` |
| Subscription payment | `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| Order | `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| Kitchen ticket | `ACTIVE`, `READY`, `ARCHIVED` |
| Table | `AVAILABLE`, `OCCUPIED`; separate `served: boolean` |
| Payment | `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED` |
| Inventory deletion request | `PENDING`, `APPROVED`, `REJECTED` |

## 11. Database and Prisma rules

Schema location: `prisma/schema.prisma`.

```bash
pnpm prisma:generate
npx prisma migrate dev --name meaningful_migration_name
npx prisma migrate deploy
```

- Create a migration for every schema change; do not use `db push` for production changes.
- Use `prisma migrate deploy` in deployed environments. Docker entrypoint runs it when `RUN_PRISMA_MIGRATIONS=true`.
- Do not run `prisma migrate reset` against a shared or production database. It deletes data.
- Prisma `P1001` means the configured database host/port cannot be reached. Check `DATABASE_URL`, network access, database availability, and SSL parameters.
- If Docker uses Alpine/musl, Prisma engine binary targets must match the container. The supplied image is Debian Bookworm to avoid that class of mismatch.

## 12. Docker deployment

The repository includes `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`, and `compose.yaml`.

On the server:

```bash
cd ~/abiarene-backend
git fetch origin
git reset --hard origin/main
sudo docker compose down
sudo docker compose up --build -d
sudo docker compose ps
sudo docker compose logs -f backend
```

The Compose setup exposes port `3000` directly. With public IP `SERVER_IP`:

- API: `http://SERVER_IP:3000/api`
- Swagger: `http://SERVER_IP:3000/api/docs`

Open inbound TCP port `3000` in the EC2 security group for temporary direct access. For a real public deployment, place a reverse proxy/load balancer in front, use a domain, enable TLS, restrict CORS to frontend domains, and configure Stripe/Paystack webhook URLs to the HTTPS public URL.

## 13. High-risk areas for future changes

- Do not expose provider secret keys, database URLs, or JWT secrets in source, Swagger examples, logs, or handover material.
- Keep `tokenVersion` checks in both HTTP JWT validation and Socket.IO connection validation. They invalidate old tokens after logout/reset.
- Preserve tenant filtering on every tenant-owned query and relation lookup.
- Do not allow manager deletion requests to delete inventory before supervisor approval.
- Direct cashier orders deliberately have `tableId=null` and must use direct checkout, not `/tables/:id/cashier-checkout`.
- Stripe payment completion must be trusted from the verified webhook/provider status, not from a client redirect alone.
- Payment/provider currencies are ISO codes. UI labels can say `CFA`, but backend values must use `XAF`.
- Existing timestamps are UTC. Reporting must retain timezone-aware boundaries when adding charts or date filters.
- `GET /api/tenant/:tenantId/roles` is shared for admin and own-tenant manager/supervisor access. Admin cross-tenant route is `GET /api/tenant/all/:tenantId/roles`; do not reintroduce duplicate route patterns.

## 14. Suggested first tasks for the incoming developer

1. Copy the production environment values into the target server secret manager or `.env`, rotate every existing secret, and verify `pnpm build`.
2. Run migrations with `npx prisma migrate deploy` and verify seed data only in non-production environments.
3. Log in as admin, supervisor, manager, server, kitchen, and cashier; verify their Swagger routes return the expected 200/403 responses.
4. Test one complete dine-in flow and one direct inventory checkout flow.
5. Connect a client to `/notifications`, then send an order to kitchen, bump it ready, and complete payment to validate realtime events.
6. Test subscription checkout using provider test credentials and verify the webhook changes the tenant subscription to `ACTIVE`.
