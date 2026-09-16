# Kitchen Workflow

Kitchen board operator. **Cannot self-register** — created by Owner/Manager (or Admin) after `KITCHEN` role is enabled.

JWT: `role: KITCHEN`, `tenantId` required.

---

## 1. How kitchen staff enters the system

```text
Enable KITCHEN role
  PATCH /api/tenant/:tenantId/roles
  { "kitchen": true }

Create user
  POST /api/users
  { name, email, pin, roleName: "KITCHEN" }

Login
  POST /api/auth/login
  { email, pin }
```

---

## 2. Core kitchen flow

```text
Floor sends order to kitchen
  (Server/Manager/Supervisor/Cashier)
  POST /api/orders/:id/send-to-kitchen
  -> order PREPARING, ticket ACTIVE
  -> notification ORDER_SENT_TO_KITCHEN

Kitchen opens board
  GET /api/tickets/kitchen-board
  GET /api/tickets
  GET /api/tickets/:id

Mark ready when cooked
  POST /api/tickets/:id/bump-to-ready
  -> ticket ACTIVE -> READY
  -> order PREPARING -> READY
  -> notification ORDER_READY

Archive when picked up / done
  POST /api/tickets/:id/force-archive
  -> ticket -> ARCHIVED
  -> order -> COMPLETED
  -> notification ORDER_ARCHIVED
```

Realtime: connect to `/notifications` with JWT; on `notification:new` refetch kitchen board.

Order history for context:

```http
GET /api/orders/history
```

---

## 3. Capability map

| Area | Can do |
| --- | --- |
| View tenant | `GET /api/tenant/me` |
| Own profile | `GET/PATCH /api/users/me` |
| Kitchen board | Yes |
| Tickets | List, get, bump-to-ready, force-archive |
| Orders | History only (no create/update) |
| Menu / tables / inventory | Read where unscoped GET allows |
| Discounts | Read |
| Checkout / staff / reports / subscription | No |

---

## 4. API reference (kitchen-accessible)

### Auth & profile

| Method | Path |
| --- | --- |
| `POST` | `/api/auth/login` |
| `POST` | `/api/auth/logout` |
| `GET` | `/api/users/me` |
| `PATCH` | `/api/users/me` |
| `GET` | `/api/tenant/me` |

### Tickets (primary)

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/tickets/kitchen-board` | Main board |
| `GET` | `/api/tickets` | List |
| `GET` | `/api/tickets/:id` | Get |
| `POST` | `/api/tickets/:id/bump-to-ready` | ACTIVE → READY |
| `POST` | `/api/tickets/:id/force-archive` | Archive |

### Supporting reads

| Method | Path |
| --- | --- |
| `GET` | `/api/orders/history` |
| `GET` | `/api/items` |
| `GET` | `/api/items/:id` |
| `GET` | `/api/tables` |
| `GET` | `/api/tables/menu` |
| `GET` | `/api/tables/:id` |
| `GET` | `/api/inventory` |
| `GET` | `/api/inventory/:id` |
| `GET` | `/api/discount` |
| `GET` | `/api/discount/:id` |
| `GET/PATCH` | `/api/notifications` … |
| `POST/GET/PATCH/DELETE` | `/api/payments` … |

---

## 5. Ticket / order states

| Ticket | Order (typical) |
| --- | --- |
| `ACTIVE` | `PREPARING` |
| `READY` | `READY` |
| `ARCHIVED` | `COMPLETED` |

Kitchen does **not** create orders, send-to-kitchen, or run cashier checkout.
