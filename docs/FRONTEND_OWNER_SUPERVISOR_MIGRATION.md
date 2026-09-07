# Frontend Migration Guide: OWNER + Staff SUPERVISOR

**Audience:** mobile / web app developers integrating with this backend.  
**Backend cutover:** DB reset (no dual-compat). Old JWTs / seed users with tenant-owner `SUPERVISOR` will not work after reset.

Related playbooks: [workflows/owner.md](./workflows/owner.md) · [workflows/supervisor.md](./workflows/supervisor.md) · [role.md](./role.md)

---

## 1. What changed (summary)

| Before | After |
| --- | --- |
| Tenant owner role = `SUPERVISOR` | Tenant owner role = `OWNER` |
| Self-register created a supervisor | Self-register creates an **owner** (`pendingRole` / JWT `role: "OWNER"`) |
| Supervisor enabled roles, support, uploads, credential reset | **Owner** does those |
| — | New staff role `SUPERVISOR` = Manager + inventory elevation + discount approval + cashier oversight |
| Admin path `…/reset-supervisor-credentials` | **`…/reset-owner-credentials`** |
| Create-tenant response field `supervisor` | Response field **`owner`** |
| Discount: manager could activate freely | Manager creates **drafts** only (`isActive` forced `false`); Owner/Supervisor activate |

```text
Register → OWNER (no tenant)
  → POST /tenant/create → OWNER role always
  → optional enable manager/supervisor/server/kitchen/cashier
  → re-login for JWT with tenantId
```

---

## 2. Role model for the app

Treat JWT / user `role` string as:

| `role` | UI label (suggested) | Who |
| --- | --- | --- |
| `ADMIN` | Admin | Platform |
| `OWNER` | Owner | Tenant owner (was “Supervisor” in old UI) |
| `SUPERVISOR` | Supervisor | Staff (new meaning) |
| `MANAGER` | Manager | Staff |
| `SERVER` | Server | Staff |
| `KITCHEN` | Kitchen | Staff |
| `CASHIER` | Cashier | Staff |

**Critical frontend rule:** anywhere you had `role === 'SUPERVISOR'` meaning “business owner”, change to `role === 'OWNER'`.  
Staff supervisor screens use `role === 'SUPERVISOR'` with **limited** nav (not owner portal).

---

## 3. API changes (request / response / impact)

### 3.1 Auth

#### `POST /api/auth/register`

| | Before | After |
| --- | --- | --- |
| Meaning | Create supervisor | Create **owner** |
| Body | `{ name, email, pin }` | Unchanged |
| Response `user.role` | `"SUPERVISOR"` | **`"OWNER"`** |
| DB | `pendingRole: SUPERVISOR` | `pendingRole: OWNER` |

**Frontend:** rename signup copy (“Register as Owner”). Store `role: OWNER`. Do not gate onboarding on `SUPERVISOR`.

#### `POST /api/auth/login`

| | Before | After |
| --- | --- | --- |
| Body | `{ email, pin }` | Unchanged |
| Owner JWT | `role: SUPERVISOR` | **`role: OWNER`** |
| Staff supervisor JWT | — | **`role: SUPERVISOR`** (new) |

**Frontend:** after login, route by `user.role`:

- `OWNER` → owner dashboard / onboarding if no `tenantId`
- `SUPERVISOR` → staff supervisor home (not tenant setup)
- `MANAGER` / `SERVER` / … → existing staff homes

#### `POST /api/auth/logout`

Unchanged.

---

### 3.2 Tenant create & roles

#### `POST /api/tenant/create`

| | Before | After |
| --- | --- | --- |
| Auth | JWT `SUPERVISOR`, no tenant | JWT **`OWNER`**, no tenant (`@AllowWithoutTenant`) |
| Body flags | `manager?, server?, kitchen?, cashier?` | Same **+ `supervisor?: boolean`** (staff role) |
| Always creates role | `SUPERVISOR` | **`OWNER`** |
| Response user key | `supervisor: { … }` | **`owner: { … }`** |

Example body:

```json
{
  "name": "Demo Bistro",
  "industry": "RESTAURANT",
  "countryCode": "BD",
  "currencyCode": "BDT",
  "subscriptionPriceId": "<uuid>",
  "startWithFreeTrial": false,
  "manager": true,
  "supervisor": true,
  "server": true,
  "kitchen": true,
  "cashier": true
}
```

**Frontend:**

1. Call only when logged-in user has `role === 'OWNER'` and no `tenantId`.
2. Add UI toggle “Enable Supervisor” → send `supervisor: true`.
3. Read `response.owner` (not `response.supervisor`).
4. **Re-login** (or refresh token via login) so JWT includes `tenantId`.

#### `PATCH /api/tenant/:tenantId/roles`

| | Before | After |
| --- | --- | --- |
| Who | Admin **or Supervisor** | Admin **or Owner** only |
| Body | `{ manager?, supervisor?, server?, kitchen?, cashier? }` | Same shape; `supervisor` enables **staff** SUPERVISOR |

```json
{ "manager": true, "supervisor": true, "server": true, "kitchen": true, "cashier": true }
```

**Frontend:**

- Show “Enable roles” only for `OWNER` (and admin console).
- Staff `SUPERVISOR` must get **403** if they hit this — hide the screen.
- Role chips: Manager, Supervisor, Server, Kitchen, Cashier (no Owner toggle).

#### `GET /api/tenant/:tenantId/roles`

Allowed: `owner`, `manager`, `supervisor`, `admin` (own tenant for staff). Unchanged shape; may now include `OWNER` and `SUPERVISOR` rows.

---

### 3.3 Users / credentials

#### `POST /api/users` (create staff)

Body field `role` enum now includes **`SUPERVISOR`** as assignable staff (when that role is enabled):

```json
{ "name": "Sam", "email": "sam@example.com", "pin": "4444", "role": "SUPERVISOR" }
```

Also: `MANAGER`, `SERVER`, `KITCHEN`, `CASHIER`.  
Do **not** create staff with `role: "OWNER"` via this endpoint (owner comes from register + tenant create).

#### `PATCH /api/users/:id/reset-credentials`

| | Before | After |
| --- | --- | --- |
| Who | Supervisor | **Owner only** |
| Targets | Manager, Cashier, Server, Kitchen | Manager, **Supervisor**, Cashier, Server, Kitchen |

**Frontend:** show “Reset credentials” only for `OWNER`.

#### Admin: reset owner credentials

| Before | After |
| --- | --- |
| `PATCH /api/users/tenant/:tenantId/:id/reset-supervisor-credentials` | **`PATCH /api/users/tenant/:tenantId/:id/reset-owner-credentials`** |

**Frontend (admin app):** update path; target user must be `OWNER`.

---

### 3.4 Owner-only APIs (were supervisor-only)

Gate these screens/actions on `role === 'OWNER'` (not `SUPERVISOR`):

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/tenant/create` | Onboarding |
| `PATCH` | `/api/tenant/:tenantId/roles` | Enable staff roles |
| `POST` | `/api/support` | Open ticket |
| `GET` | `/api/support` | List (owner scope) |
| `GET` | `/api/support/:id` | Detail |
| `POST` | `/api/support/:id/messages` | Reply |
| `POST` | `/api/uploads/image` | + Admin |
| `PATCH` | `/api/users/:id/reset-credentials` | Reset staff |

Support message `senderRole` persisted as **`OWNER`** (was `SUPERVISOR`).

---

### 3.5 Shared ops (owner + staff supervisor + manager)

These remain available to **OWNER**, **SUPERVISOR**, and usually **MANAGER** (same as before for manager/old-supervisor ops). Ensure nav includes `OWNER` wherever you had `SUPERVISOR` for ops:

Examples:

- Menu / tables / orders / tickets (as before for manager)
- `GET/PATCH` tenant overview & subscription (owner + manager + supervisor)
- Cashier supervise: `GET …/cashier-summary`, `POST …/cashier-checkout`
- Staff CRUD: `POST/GET/PATCH/DELETE /api/users` (manager, supervisor, owner)

**Still cashier-only (do not give to supervisor):**

- `POST /api/orders/cashier-direct`
- `POST /api/orders/cashier-direct-inventory`
- `POST /api/orders/:id/cashier-direct-checkout`

---

### 3.6 Inventory

| Action | Manager | Staff Supervisor | Owner |
| --- | :---: | :---: | :---: |
| Create / update / list | ✓ | ✓ | ✓ |
| Delete | Creates **PENDING** request | **Deletes immediately** | **Deletes immediately** |
| Approve / reject delete request | ✗ | ✓ | ✓ (+ Admin) |

APIs:

- `DELETE /api/inventory/:id`
- `GET /api/inventory/delete-requests`
- `POST /api/inventory/delete-requests/:requestId/approve`
- `POST /api/inventory/delete-requests/:requestId/reject`

**Frontend:**

- Manager: show “Pending approval” after delete.
- Owner/Supervisor: treat delete as hard delete; show approve queue for manager requests.

---

### 3.7 Discounts (behavior change)

| Action | Manager | Staff Supervisor | Owner | Admin |
| --- | :---: | :---: | :---: | :---: |
| Create / update | ✓ but **`isActive` forced false** | ✓ can set active | ✓ | ✓ |
| Set `isActive: true` (approve) | ✗ (403) | ✓ | ✓ | ✓ |
| Delete | ✗ | ✓ | ✓ | ✓ |
| List / get | ✓ | ✓ | ✓ | ✓ |

APIs: `POST/PATCH/GET/DELETE /api/discount`

**Frontend:**

1. Manager “Create discount” → save as draft; show “Pending activation”.
2. Owner/Supervisor → “Activate” toggle / button sets `isActive: true` via `PATCH`.
3. Hide delete for manager; show for owner/supervisor.
4. Checkout should only apply discounts with `isActive: true` (backend already filters inactive where used).

---

### 3.8 Reports

`GET /api/tenant/overview?range=…&timezone=…`

| Role | Allowed `range` |
| --- | --- |
| `OWNER` | `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |
| `MANAGER`, `SUPERVISOR` | `daily`, `monthly` only |

**Frontend:** disable weekly/quarterly/yearly for manager and staff supervisor (403 if sent).

---

## 4. Frontend checklist (what to change in the app)

### Auth & routing

- [ ] Replace owner detection: `SUPERVISOR` → **`OWNER`**
- [ ] Signup flow title / success: “Owner account”
- [ ] After register: still call `POST /tenant/create`, then **login again** for `tenantId`
- [ ] Staff login: support new role `SUPERVISOR` with its own home (not onboarding)

### Navigation / feature flags

Suggested helper:

```ts
const isOwner = role === 'OWNER';
const isStaffSupervisor = role === 'SUPERVISOR';
const canManageOps = ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(role);
const canApproveInventory = ['OWNER', 'SUPERVISOR', 'ADMIN'].includes(role);
const canActivateDiscount = ['OWNER', 'SUPERVISOR', 'ADMIN'].includes(role);
const canEnableRoles = isOwner || role === 'ADMIN';
const canOpenSupport = isOwner;
const canUpload = isOwner || role === 'ADMIN';
const canResetCredentials = isOwner;
```

- [ ] Hide Enable Roles / Support / Uploads / Reset Credentials unless `canEnableRoles` / `canOpenSupport` / etc.
- [ ] Staff supervisor: show inventory approve + discount activate + cashier supervise; hide owner portal

### Forms & payloads

- [ ] Tenant create: add `supervisor` checkbox; read `response.owner`
- [ ] Enable roles body: include `supervisor?: boolean`
- [ ] Staff create role picker: add **Supervisor** option (`role: "SUPERVISOR"`)
- [ ] Admin: rename API to `reset-owner-credentials`

### Discounts UI

- [ ] Manager: no activate toggle (or disabled); label drafts
- [ ] Owner/Supervisor: activate / delete actions

### Inventory UI

- [ ] Manager pending banner
- [ ] Owner/Supervisor approve queue + direct delete confirmation

### Copy / i18n

- [ ] Old “Supervisor” = owner → rename to **Owner**
- [ ] New staff role label **Supervisor** for `SUPERVISOR`

### Breaking / environment

- [ ] Coordinate with backend **DB reset + reseed**
- [ ] Clear local storage / secure store tokens after deploy
- [ ] Update QA accounts (see seeds below)

---

## 5. Seed accounts (after `prisma migrate reset` + seed)

| Role | Email | PIN |
| --- | --- | --- |
| Admin | `admin@example.com` | `1234` |
| Owner | `sara.owner@example.com` | `3333` |
| Staff Supervisor | `sam.supervisor@example.com` | `4444` |
| Manager | `alice.manager@example.com` | `1111` |
| Server | `bob.server@example.com` | `2222` |

---

## 6. Quick “if X breaks” map

| Symptom | Likely frontend bug |
| --- | --- |
| 403 on create tenant after register | Still checking `SUPERVISOR` or using old token without OWNER |
| 403 on enable roles as “supervisor” user | That user is staff SUPERVISOR; only OWNER can enable roles |
| Create tenant response undefined user | Still reading `response.supervisor` → use `response.owner` |
| Admin reset 404 | Still calling `reset-supervisor-credentials` |
| Manager discount stays inactive | Expected; owner/supervisor must activate |
| Manager delete doesn’t remove product | Expected; wait for owner/supervisor approve |
| Overview weekly 403 for supervisor | Staff supervisor limited to daily/monthly |

---

## 7. Swagger

Interactive contract: `/api/docs`  
Use it as source of truth for DTO fields after pull.
