# Admin Workflow

Platform owner. Lives in the separate `Admin` table (not tenant `User`). JWT has `role: ADMIN` and **no** `tenantId`. Admins bypass `TenantGuard`.

---

## 1. Onboarding / login

```text
Create admin account
  -> POST /api/admin/signup          (public)
  -> body: { name, email, pin }

Login
  -> POST /api/auth/login            (public)
  -> body: { email, pin }
  -> returns JWT (role=ADMIN)

Logout
  -> POST /api/auth/logout           (Bearer)
  -> bumps tokenVersion; old JWT invalid
```

Seed credentials (non-prod): `admin@example.com` / `1234`

---

## 2. End-to-end platform flow

```text
1. Admin signs up / logs in
2. Create subscription plans (FREE / MONTHLY / YEARLY)
3. Supervisors register and create tenants independently
4. Admin lists tenants, enables roles, toggles tenant status
5. Optional: create tenant-scoped subscription vouchers
6. Cross-tenant manage staff, menu items, tables, inventory, discounts
7. Reply to owner support tickets
8. Monitor platform dashboard
```

---

## 3. Capability map

| Area | Can do |
| --- | --- |
| Dashboard | Platform metrics (`?currency=` for display) |
| Subscription prices | Create / update / delete fixed plans |
| Tenants | List all, enable roles, set ACTIVE/INACTIVE |
| Subscription vouchers | Create/list/update/delete (tenant-scoped) |
| Staff (any tenant) | CRUD + reset **owner** credentials |
| Menu items (any tenant) | Full CRUD via `/items/tenant/:tenantId` |
| Tables (any tenant) | Full CRUD + menu via `/tables/tenant/:tenantId` |
| Inventory | CRUD + approve/reject deletion requests |
| Discounts | CRUD (including activate) |
| Support | List, reply, close tickets |
| Uploads | Cloudinary image upload |
| Notifications | Own inbox |
| Tenant create / subscribe | No — owner owns that |

---

## 4. API reference (admin-accessible)

### Auth & self

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/admin/signup` | Public — create admin |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/logout` | Invalidate JWT |
| `GET` | `/api/admin/me` | Current admin profile |
| `GET` | `/api/admin/dashboard?currency=EUR` | Platform dashboard |

### Subscription plans

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/admin/subscription-prices?currency=EUR` | Public list (optional converted display) |
| `POST` | `/api/admin/subscription-prices` | Create plan (`FREE` / `MONTHLY` / `YEARLY`) |
| `PATCH` | `/api/admin/subscription-prices/:id` | Update plan |
| `DELETE` | `/api/admin/subscription-prices/:id` | Delete plan |

### Tenant-scoped subscription vouchers

```text
Admin creates offer for one tenant
  -> POST /api/admin/tenants/:tenantId/subscription-vouchers
  -> voucher cannot be used by another tenant

Supervisor/Manager later applies it at
  -> POST /api/tenant/subscription/pay  { voucherCode }
```

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/admin/tenants/:tenantId/subscription-vouchers` | Create for one tenant |
| `GET` | `/api/admin/tenants/:tenantId/subscription-vouchers` | List for one tenant |
| `GET` | `/api/admin/subscription-vouchers` | List all |
| `PATCH` | `/api/admin/subscription-vouchers/:id` | Update |
| `DELETE` | `/api/admin/subscription-vouchers/:id` | Delete |

### Tenants

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tenant/all?page=1&limit=20&currency=EUR` | Paginated tenants |
| `GET` | `/api/tenant/all/:tenantId/roles` | Roles for any tenant |
| `PATCH` | `/api/tenant/:tenantId/roles` | Enable/disable role flags |
| `PATCH` | `/api/tenant/:tenantId/status` | ACTIVE / INACTIVE |
| `GET` | `/api/tenant/:tenantId/roles` | Shared roles route (admin allowed) |

### Staff (cross-tenant)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/users/tenant/:tenantId` | Create staff under tenant |
| `GET` | `/api/users/tenant/:tenantId` | List staff |
| `GET` | `/api/users/tenant/:tenantId/:id` | Get one |
| `PATCH` | `/api/users/tenant/:tenantId/:id` | Update |
| `PATCH` | `/api/users/tenant/:tenantId/:id/reset-owner-credentials` | Reset owner email/PIN |
| `DELETE` | `/api/users/tenant/:tenantId/:id` | Delete |

### Menu items (cross-tenant)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/items/tenant/:tenantId` | Create |
| `GET` | `/api/items/tenant/:tenantId` | List (`?search=` name/category) |
| `GET` | `/api/items/tenant/:tenantId/:id` | Get |
| `PATCH` | `/api/items/tenant/:tenantId/:id` | Update |
| `DELETE` | `/api/items/tenant/:tenantId/:id` | Delete |

### Tables (cross-tenant)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/tables/tenant/:tenantId` | Create table |
| `GET` | `/api/tables/tenant/:tenantId` | List |
| `GET` | `/api/tables/tenant/:tenantId/menu` | Shared menu |
| `PATCH` | `/api/tables/tenant/:tenantId/menu` | Set menu selections |
| `DELETE` | `/api/tables/tenant/:tenantId/menu/items/:itemId` | Remove menu item |
| `GET` | `/api/tables/tenant/:tenantId/:id` | Get table |
| `GET` | `/api/tables/tenant/:tenantId/:id/items` | Table items |
| `PATCH` | `/api/tables/tenant/:tenantId/:id` | Update |
| `DELETE` | `/api/tables/tenant/:tenantId/:id` | Delete |

### Inventory

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/inventory` | Create product |
| `GET` | `/api/inventory` | List/search (needs tenant context on staff routes; admin uses role-allowed mutations) |
| `GET` | `/api/inventory/delete-requests` | Pending manager deletions |
| `POST` | `/api/inventory/delete-requests/:requestId/approve` | Approve → product deleted |
| `POST` | `/api/inventory/delete-requests/:requestId/reject` | Reject |
| `PATCH` | `/api/inventory/:id` | Update |
| `DELETE` | `/api/inventory/:id` | Delete |

### Discounts

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/discount` | Create |
| `GET` | `/api/discount` | List |
| `GET` | `/api/discount/:id` | Get |
| `PATCH` | `/api/discount/:id` | Update |
| `DELETE` | `/api/discount/:id` | Delete |

### Support (admin side)

```text
Supervisor opens ticket
  -> POST /api/support

Admin lists / reads
  -> GET /api/support
  -> GET /api/support/:id

Admin replies
  -> POST /api/support/:id/messages

Admin closes
  -> PATCH /api/support/:id/status   { status: CLOSED }
```

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/support` | All tickets |
| `GET` | `/api/support/:id` | One ticket |
| `POST` | `/api/support/:id/messages` | Reply |
| `PATCH` | `/api/support/:id/status` | Open / Close |

### Uploads & notifications

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/uploads/image` | Cloudinary upload |
| `GET` | `/api/notifications` | Inbox |
| `GET` | `/api/notifications/unread-count` | Unread count |
| `PATCH` | `/api/notifications/:id/read` | Mark one read |
| `PATCH` | `/api/notifications/read-all` | Mark all read |

Realtime: Socket.IO namespace `/notifications` with JWT in `auth.token`.

---

## 5. What admin does **not** do

- Create a business tenant for themselves (`POST /api/tenant/create` is owner-only)
- Place dine-in / cashier orders or run kitchen tickets (tenant staff flows)
- Pay a tenant subscription (owner/manager/supervisor)

Those belong to [owner.md](./owner.md), [supervisor.md](./supervisor.md), and floor roles.
