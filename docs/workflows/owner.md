# Owner Workflow

Tenant owner. Self-registers, creates the business (tenant), pays subscription, configures roles/staff, and oversees operations.

JWT: `role: OWNER`, `tenantId` after tenant create.

Seed (demo): `sara.owner@example.com` / `3333`

---

## 1. Onboarding (register → tenant → subscribe)

```text
POST /api/auth/register
  { name, email, pin }
  -> pendingRole=OWNER, JWT role=OWNER (no tenantId)

POST /api/tenant/create   (@AllowWithoutTenant, @Roles('owner'))
  {
    name, industry, countryCode, currencyCode, subscriptionPriceId,
    startWithFreeTrial?, manager?, supervisor?, server?, kitchen?, cashier?
  }
  -> always creates OWNER role; optional staff roles as flagged
  -> user attached; pendingRole cleared
  -> re-login to get JWT with tenantId

POST /api/tenant/subscription/pay  (owner or manager)
GET  /api/tenant/subscription/payments/:reference/status
```

---

## 2. Enable staff roles (owner only)

```text
PATCH /api/tenant/:tenantId/roles
  { manager?, supervisor?, server?, kitchen?, cashier? }
```

Admin may also call this route. **SUPERVISOR cannot.**

Then create staff: `POST /api/users` with `role: "SUPERVISOR" | "MANAGER" | …`

Reset staff credentials: `PATCH /api/users/:id/reset-credentials` (owner only; targets manager/supervisor/cashier/server/kitchen)

Admin reset owner: `PATCH /api/users/tenant/:tenantId/:id/reset-owner-credentials`

---

## 3. Owner-exclusive capabilities

| Area | Access |
| --- | --- |
| Create tenant | yes |
| Enable roles | yes |
| Support tickets | yes |
| Uploads | yes (+ admin) |
| Reset staff credentials | yes |
| Inventory direct delete + approve | yes |
| Discount activate/delete | yes |
| Overview ranges | all (`daily`…`yearly`) |
| Full ops (menu, tables, orders, subscription, staff CRUD) | yes |

See [supervisor.md](./supervisor.md) for the limited staff supervisor role.
