# Cashier Workflow

Checkout and counter sales. **Cannot self-register** — created by Owner/Manager (or Admin) after `CASHIER` role is enabled.

JWT: `role: CASHIER`, `tenantId` required.

Two sale modes:

1. **Dine-in table checkout** — pay completed table orders, free the table  
2. **Direct order** — no table (`orderType=DIRECT`, `tableId=null`) for counter / retail

---

## 1. How a cashier enters the system

```text
Enable CASHIER role
  PATCH /api/tenant/:tenantId/roles
  { "cashier": true }

Create user
  POST /api/users
  { name, email, pin, roleName: "CASHIER" }

Login
  POST /api/auth/login
  { email, pin }
```

---

## 2. Flow A — Dine-in table checkout

```text
Server/others already: order -> kitchen -> ready -> archived (order COMPLETED)

Cashier previews table bill
  GET /api/tables/:tableId/cashier-summary

Cashier completes payment
  POST /api/tables/:tableId/cashier-checkout
  -> payment records COMPLETED
  -> paid table orders settled
  -> table AVAILABLE, served=false
  -> notification PAYMENT_COMPLETED
```

Cashier may also create dine-in orders and send them to kitchen:

```text
POST /api/orders
POST /api/orders/:id/send-to-kitchen
POST /api/tickets/:id/bump-to-ready
POST /api/tickets/:id/force-archive
```

---

## 3. Flow B — Direct sale (no table)

Use for counter sales, supershops, hardware, etc. **Do not** invent a fake counter table.

### Menu items

```text
POST /api/orders/cashier-direct
  -> orderType=DIRECT, tableId=null, status CONFIRMED

Optional kitchen
  POST /api/orders/:id/send-to-kitchen
  POST /api/tickets/:id/bump-to-ready
  POST /api/tickets/:id/force-archive

Pay
  POST /api/orders/:id/cashier-direct-checkout
  -> payment created, order COMPLETED
```

### Inventory products

```text
POST /api/orders/cashier-direct-inventory
  -> DIRECT order from inventory products

POST /api/orders/:id/cashier-direct-checkout
  -> payment + inventory decrement when applicable
  -> order COMPLETED
```

**Wrong path:** do not use `POST /api/tables/:id/cashier-checkout` for direct orders.

---

## 4. Capability map

| Area | Can do |
| --- | --- |
| View tenant | `GET /api/tenant/me` |
| Own profile | `GET/PATCH /api/users/me` |
| Dine-in orders | Create, list, get, send-to-kitchen (no patch/delete/cancel) |
| Direct orders | `cashier-direct`, `cashier-direct-inventory`, `cashier-direct-checkout` |
| Table checkout | Summary + cashier-checkout |
| Tickets | bump-to-ready, force-archive (no list/board — list requires server+; cashier has bump/archive only) |
| Menu / tables / inventory | Read |
| Discounts | Read |
| Staff / reports / subscription / support | No |

Note on tickets: `@Roles` on `GET /api/tickets` and kitchen-board do **not** include cashier. Cashier can still `bump-to-ready` and `force-archive` by ticket id.

---

## 5. API reference (cashier-accessible)

### Auth & profile

| Method | Path |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/users/me` |
| `PATCH` | `/api/users/me` |
| `GET` | `/api/tenant/me` |

### Orders (cashier-specific + shared)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/orders` | Dine-in create |
| `POST` | `/api/orders/cashier-direct` | Direct menu order |
| `POST` | `/api/orders/cashier-direct-inventory` | Direct inventory order |
| `POST` | `/api/orders/:id/cashier-direct-checkout` | Complete direct payment |
| `GET` | `/api/orders` | List |
| `GET` | `/api/orders/history` | History |
| `GET` | `/api/orders/:id` | Get |
| `POST` | `/api/orders/:id/send-to-kitchen` | Hand off |

### Tables (checkout)

| Method | Path |
| --- | --- |
| `GET` | `/api/tables` |
| `GET` | `/api/tables/menu` |
| `GET` | `/api/tables/:id` |
| `GET` | `/api/tables/:id/items` |
| `GET` | `/api/tables/:id/cashier-summary` |
| `POST` | `/api/tables/:id/cashier-checkout` |

### Tickets

| Method | Path |
| --- | --- |
| `POST` | `/api/tickets/:id/bump-to-ready` |
| `POST` | `/api/tickets/:id/force-archive` |

### Catalog reads / payments / notifications

| Method | Path |
| --- | --- |
| `GET` | `/api/items` |
| `GET` | `/api/items/:id` |
| `GET` | `/api/inventory` |
| `GET` | `/api/inventory/:id` |
| `GET` | `/api/inventory/by-inventory/:inventory` |
| `GET` | `/api/discount` |
| `GET` | `/api/discount/:id` |
| `POST/GET/PATCH/DELETE` | `/api/payments` … |
| `GET/PATCH` | `/api/notifications` … |

---

## 6. Payment states

| Entity | Values |
| --- | --- |
| Order payment | `PENDING` → `COMPLETED` / `FAILED` / `REFUNDED` |
| Table after checkout | `AVAILABLE`, `served=false` |
| Direct order after checkout | `COMPLETED` |
