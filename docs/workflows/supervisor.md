# Supervisor Workflow (staff)

Limited staff role. **Cannot self-register** — enabled by Owner via roles API, then created with `POST /api/users`.

JWT: `role: SUPERVISOR`, `tenantId` required.

**Same as MANAGER**, plus:

- Elevated inventory (direct delete + approve/reject deletion requests)
- Discount approval (`isActive: true`) and discount delete
- Cashier supervision (table cashier-summary / checkout, order oversight)

Seed (demo): `sam.supervisor@example.com` / `4444`

---

## 1. How a supervisor enters the system

```text
Owner enables SUPERVISOR role
  PATCH /api/tenant/:tenantId/roles
  { "supervisor": true }

Owner/Manager creates user
  POST /api/users
  { name, email, pin, role: "SUPERVISOR" }

Login
  POST /api/auth/login
```

---

## 2. What supervisor cannot do

| Area | Access |
| --- | --- |
| Create tenant / register as owner | no |
| `PATCH /tenant/:id/roles` | no |
| Support tickets | no |
| Uploads | no |
| Reset staff credentials | no |
| Overview ranges beyond daily/monthly | no |
| Cashier-direct create/checkout | no (cashier only) |

---

## 3. Elevated vs manager

### Inventory

```text
DELETE /api/inventory/:id
  -> product deleted immediately (manager would create PENDING request)

GET  /api/inventory/delete-requests
POST /api/inventory/delete-requests/:requestId/approve
POST /api/inventory/delete-requests/:requestId/reject
```

### Discounts

```text
Manager may POST/PATCH draft discounts (forced isActive=false)
Supervisor / Owner / Admin may set isActive=true (approve) and DELETE
```

### Cashier supervision

```text
GET  /api/tables/:id/cashier-summary
POST /api/tables/:id/cashier-checkout
GET  /api/orders
GET  /api/orders/history
```

Same day-to-day ops as manager otherwise: staff CRUD (no credential reset), menu, tables, orders, limited reports, subscription pay.
