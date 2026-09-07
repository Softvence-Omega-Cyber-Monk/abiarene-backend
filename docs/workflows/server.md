# Server Workflow

Floor staff for dine-in. **Cannot self-register** — created by Owner/Manager (or Admin) after `SERVER` role is enabled.

JWT: `role: SERVER`, `tenantId` required.

---

## 1. How a server enters the system

```text
Enable SERVER role
  PATCH /api/tenant/:tenantId/roles
  { "server": true }

Create user
  POST /api/users
  { name, email, pin, roleName: "SERVER" }

Login
  POST /api/auth/login
  { email, pin }

POS helpers (public)
  GET /api/auth/tenants
  GET /api/auth/tenants/:tenantId/users
```

Seed (demo): `bob.server@example.com` / `2222`

---

## 2. Core dine-in flow (server)

```text
View tables / menu
  GET /api/tables
  GET /api/tables/menu
  GET /api/tables/:id
  GET /api/tables/:id/items
  GET /api/items

Create order for a table
  POST /api/orders
  -> table becomes OCCUPIED
  -> order CONFIRMED

Update / cancel if needed
  PATCH  /api/orders/:id
  POST   /api/orders/:id/cancel
  DELETE /api/orders/:id

Send to kitchen
  POST /api/orders/:id/send-to-kitchen
  -> order CONFIRMED -> PREPARING
  -> kitchen ticket ACTIVE
  -> notification ORDER_SENT_TO_KITCHEN

Watch tickets
  GET /api/tickets
  GET /api/tickets/:id

When ready / served — archive ticket
  POST /api/tickets/:id/force-archive
  -> ticket READY/ACTIVE -> ARCHIVED
  -> order -> COMPLETED

Update table fields (e.g. served flag)
  PATCH /api/tables/:id

Checkout is Cashier/Manager/Supervisor/Owner:
  POST /api/tables/:tableId/cashier-checkout
```

Realtime: listen on Socket.IO `/notifications` for `notification:new`, then refetch orders/tickets/tables.

---

## 3. Capability map

| Area | Can do |
| --- | --- |
| View tenant | `GET /api/tenant/me` |
| Own profile | `GET/PATCH /api/users/me` |
| Tables | List/get/items; **PATCH** table; no create/delete/menu edit |
| Menu items | Read only |
| Inventory | Read (list/get/lookup) |
| Orders | Create, list, get, update, delete, cancel, send-to-kitchen |
| Tickets | List, get, force-archive — **no** bump-to-ready, **no** kitchen-board |
| Cashier checkout / direct orders | No |
| Discounts | Read only |
| Staff / reports / subscription / support | No |

---

## 4. API reference (server-accessible)

### Auth & profile

| Method | Path |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/users/me` |
| `PATCH` | `/api/users/me` |
| `GET` | `/api/tenant/me` |

### Read catalog / floor

| Method | Path |
| --- | --- |
| `GET` | `/api/items` |
| `GET` | `/api/items/:id` |
| `GET` | `/api/tables` |
| `GET` | `/api/tables/menu` |
| `GET` | `/api/tables/:id` |
| `GET` | `/api/tables/:id/items` |
| `PATCH` | `/api/tables/:id` |
| `GET` | `/api/inventory` |
| `GET` | `/api/inventory/:id` |
| `GET` | `/api/inventory/by-inventory/:inventory` |
| `GET` | `/api/discount` |
| `GET` | `/api/discount/:id` |

### Orders

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/orders` | Dine-in |
| `GET` | `/api/orders` | List |
| `GET` | `/api/orders/history` | History |
| `GET` | `/api/orders/:id` | Get |
| `PATCH` | `/api/orders/:id` | Update |
| `DELETE` | `/api/orders/:id` | Delete |
| `POST` | `/api/orders/:id/cancel` | Cancel |
| `POST` | `/api/orders/:id/send-to-kitchen` | Hand off |

### Tickets

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tickets` | List |
| `GET` | `/api/tickets/:id` | Get |
| `POST` | `/api/tickets/:id/force-archive` | Archive |

### Payments & notifications

| Method | Path | Notes |
| --- | --- | --- |
| `POST/GET/PATCH/DELETE` | `/api/payments` … | Order payment CRUD (tenant-scoped, no `@Roles`) |
| `GET/PATCH` | `/api/notifications` … | Inbox |

---

## 5. What server does **not** call

- `POST /api/tables` / menu setup
- `POST /api/tickets/:id/bump-to-ready` (kitchen / manager / supervisor / cashier)
- `GET /api/tickets/kitchen-board`
- `POST /api/tables/:id/cashier-checkout`
- `POST /api/orders/cashier-direct*`
- Staff, reports, subscription, support, uploads
