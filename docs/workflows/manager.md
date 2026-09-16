# Manager Workflow

Day-to-day business operator for one tenant. **Cannot self-register** — created by Owner (or Admin) after the role is enabled.

JWT: `role: MANAGER`, `tenantId` required.

---

## 1. How a manager enters the system

```text
Owner enables MANAGER role
  PATCH /api/tenant/:tenantId/roles
  { "manager": true }

Owner (or Admin cross-tenant) creates the user
  POST /api/users
  { name, email, pin, role: "MANAGER" }

  Admin path:
  POST /api/users/tenant/:tenantId

Manager logs in
  POST /api/auth/login
  { email, pin }

POS login UI helpers (public)
  GET /api/auth/tenants
  GET /api/auth/tenants/:tenantId/users
```

Seed (demo): `alice.manager@example.com` / `1111`

Credential reset (owner only):

```http
PATCH /api/users/:id/reset-credentials
```

After reset, manager must log in again.

---

## 2. Typical daily flow

```text
1. Login
2. Check overview / sales
   GET /api/tenant/overview?range=daily&timezone=Africa/Douala
3. Manage menu, tables, inventory, discounts, staff
4. Oversee floor orders / kitchen / checkout as needed
5. Optional: pay / renew subscription (same routes as owner/supervisor)
```

### Inventory delete (manager path — needs approval)

```text
Manager requests delete
  DELETE /api/inventory/:id
  -> product stays visible
  -> PENDING InventoryDeletionRequest created

Owner or Supervisor decides
  POST /api/inventory/delete-requests/:requestId/approve
  POST /api/inventory/delete-requests/:requestId/reject
```

### Discounts (manager drafts only)

```text
POST/PATCH /api/discount
  -> isActive forced false
  -> Owner/Supervisor must activate
```

### Dine-in (manager can run full path)

```text
POST /api/orders
POST /api/orders/:id/send-to-kitchen
POST /api/tickets/:id/bump-to-ready
POST /api/tickets/:id/force-archive
GET  /api/tables/:id/cashier-summary
POST /api/tables/:id/cashier-checkout
```

---

## 3. Capability map

| Area | Can do |
| --- | --- |
| Staff CRUD | Yes (cannot reset credentials via reset endpoint) |
| Reset staff PIN/email | No (`reset-credentials` is owner-only) |
| Tenant profile | Read + patch `/tenant/me` |
| Reports | `daily`, `monthly` only on overview |
| Subscription pay | Yes |
| Menu / tables / inventory | Full (delete inventory → request) |
| Approve inventory deletions | No |
| Discount activate/delete | No (draft create/update only) |
| Orders / tickets / table checkout | Yes |
| Cashier-direct order APIs | No |
| Support tickets | No |
| Uploads | No |
| Enable roles / create tenant | No |

---

## 4. Reporting limits

| Route | Manager |
| --- | --- |
| `GET /api/tenant/overview?range=` | `daily`, `monthly` only |
| `GET /api/tenant/daily-sales-history` | Yes |
| `GET /api/tenant/total-transactions` | Yes |
| `GET /api/tenant/active-discounts` | Yes |

---

## 5. API reference (manager-accessible)

### Auth & profile

| Method | Path |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/users/me` |
| `PATCH` | `/api/users/me` |

### Tenant

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tenant/me` | Current tenant |
| `PATCH` | `/api/tenant/me` | Update |
| `GET` | `/api/tenant/:tenantId/roles` | List roles (own tenant) |
| `GET` | `/api/tenant/overview` | `daily` / `monthly` |
| `GET` | `/api/tenant/daily-sales-history` | |
| `GET` | `/api/tenant/total-transactions` | |
| `GET` | `/api/tenant/active-discounts` | |
| `GET` | `/api/tenant/subscription/me` | |
| `GET` | `/api/tenant/subscription/vouchers` | |
| `POST` | `/api/tenant/subscription/pay` | |
| `GET` | `/api/tenant/subscription/payments/:reference/status` | |

### Staff

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/users` | Create |
| `GET` | `/api/users` | List |
| `GET` | `/api/users/:id` | Get |
| `PATCH` | `/api/users/:id` | Update (no credential-reset shortcut) |
| `DELETE` | `/api/users/:id` | Delete |

### Inventory / items / tables

| Method | Path | Notes |
| --- | --- | --- |
| `POST/GET/PATCH/DELETE` | `/api/inventory` … | Delete → pending request |
| `GET` | `/api/inventory/stock-alerts` | |
| `GET` | `/api/inventory/delete-requests` | View pending |
| `POST/GET/PATCH/DELETE` | `/api/items` … | Menu CRUD |
| `POST/GET/PATCH/DELETE` | `/api/tables` … | Tables + menu |
| `GET` | `/api/tables/:id/cashier-summary` | |
| `POST` | `/api/tables/:id/cashier-checkout` | |

### Orders & tickets

| Method | Path |
| --- | --- |
| `POST` | `/api/orders` |
| `GET` | `/api/orders` |
| `GET` | `/api/orders/history` |
| `GET` | `/api/orders/:id` |
| `PATCH` | `/api/orders/:id` |
| `DELETE` | `/api/orders/:id` |
| `POST` | `/api/orders/:id/cancel` |
| `POST` | `/api/orders/:id/send-to-kitchen` |
| `GET` | `/api/tickets` |
| `GET` | `/api/tickets/kitchen-board` |
| `GET` | `/api/tickets/:id` |
| `POST` | `/api/tickets/:id/bump-to-ready` |
| `POST` | `/api/tickets/:id/force-archive` |

### Discounts, payments, notifications

| Method | Path |
| --- | --- |
| `POST/GET/PATCH/DELETE` | `/api/discount` … |
| `POST/GET/PATCH/DELETE` | `/api/payments` … |
| `GET/PATCH` | `/api/notifications` … |
