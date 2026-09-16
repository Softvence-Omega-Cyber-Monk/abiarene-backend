# Frontend Migration Guide: OWNER + Staff SUPERVISOR

**Audience:** frontend / mobile app developers **and coding agents** implementing UI against this backend.  
**Backend cutover:** DB reset (no dual-compat). Old JWTs and seed users that treated tenant-owner as `SUPERVISOR` **will not work** after reset.

| Related backend docs | Purpose |
| --- | --- |
| [workflows/owner.md](./workflows/owner.md) | Owner API playbook |
| [workflows/supervisor.md](./workflows/supervisor.md) | Staff supervisor playbook |
| [role.md](./role.md) | Full RBAC matrix |
| [SAAS_ARCHITECTURE.md](./SAAS_ARCHITECTURE.md) | Multi-tenant / auth model |

**How to use this doc (agent):**

1. Read §1–2 (mental model).  
2. Apply §8 search-and-replace / type updates.  
3. Implement §5 screen routing + §4 feature flags.  
4. Wire payloads from §3 exact JSON examples.  
5. Verify with §9 acceptance tests + §6 seeds.

---

## 1. What changed (summary)

| Before | After |
| --- | --- |
| Tenant owner role = `SUPERVISOR` | Tenant owner role = **`OWNER`** |
| Self-register created a supervisor | Self-register creates an **owner** (`pendingRole` / JWT `role: "OWNER"`) |
| Supervisor enabled roles, support, uploads, credential reset | **Owner** does those |
| — | New **staff** role `SUPERVISOR` = Manager + elevated inventory + discount approval + cashier oversight |
| Admin path `…/reset-supervisor-credentials` | **`…/reset-owner-credentials`** |
| Create-tenant response field `supervisor` | Response field **`owner`** |
| Discount: manager could activate freely | Manager creates **drafts** only (`isActive` forced `false`); Owner/Supervisor activate |

```text
Register → OWNER (JWT, no tenantId)
  → POST /api/tenant/create → OWNER role always (+ optional staff roles)
  → response.owner (not response.supervisor)
  → POST /api/auth/login again → JWT with tenantId
  → owner dashboard
```

**Breaking for the app:** any `if (role === 'SUPERVISOR')` that meant “business owner / onboarding / support / enable roles” must become `role === 'OWNER'`.

---

## 2. Role model for the app

| JWT `role` | Suggested UI label | Identity | Enters system how |
| --- | --- | --- | --- |
| `ADMIN` | Admin | Platform admin table | Admin signup / seed |
| `OWNER` | Owner | Tenant owner (was old “Supervisor”) | `POST /auth/register` → create tenant |
| `SUPERVISOR` | Supervisor | **Staff** (new meaning) | Owner enables role → `POST /users` |
| `MANAGER` | Manager | Staff | Owner/Manager creates |
| `SERVER` | Server | Staff | Owner/Manager creates |
| `KITCHEN` | Kitchen | Staff | Owner/Manager creates |
| `CASHIER` | Cashier | Staff | Owner/Manager creates |

### 2.1 Suggested TypeScript types

```ts
export type AppRole =
  | 'ADMIN'
  | 'OWNER'
  | 'SUPERVISOR'
  | 'MANAGER'
  | 'SERVER'
  | 'KITCHEN'
  | 'CASHIER';

/** Staff roles assignable via POST /api/users (never OWNER). */
export type StaffRole =
  | 'MANAGER'
  | 'SUPERVISOR'
  | 'SERVER'
  | 'KITCHEN'
  | 'CASHIER';

export type AuthUser = {
  sub: string;
  name?: string;
  email?: string;
  tenantId?: string; // missing for brand-new OWNER before create+re-login
  role: AppRole;
  tokenVersion?: number;
};

export type LoginResponse = {
  accessToken: string;
  user: AuthUser;
  tenant?: {
    id: string;
    name: string;
    industry: string;
    countryCode: string;
    currencyCode: string;
  } | null;
};
```

Normalize role comparisons with `.toUpperCase()` (backend RolesGuard is case-insensitive; JWT usually uppercase).

---

## 3. API changes (request / response / impact)

### 3.1 Auth

#### `POST /api/auth/register`

| | Before | After |
| --- | --- | --- |
| Meaning | Create supervisor | Create **owner** |
| Body | `{ name, email, pin }` | Unchanged |
| Response `user.role` | `"SUPERVISOR"` | **`"OWNER"`** |
| `user.tenantId` | absent | still **absent** until tenant create + re-login |

**Request**

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Sara Owner",
  "email": "sara@example.com",
  "pin": "3333"
}
```

**Response (201)**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "sub": "<userId>",
    "name": "Sara Owner",
    "email": "sara@example.com",
    "role": "OWNER",
    "tokenVersion": 0
  }
}
```

**Frontend / agent:**

- Store token + user.
- Route to **tenant onboarding** (not staff home).
- Do **not** expect `tenantId` yet.
- Copy: “Register as Owner” / “Create your business account”.

#### `POST /api/auth/login`

**Request**

```json
{ "email": "sara.owner@example.com", "pin": "3333" }
```

**Owner after onboarding (200/201)**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "sub": "<userId>",
    "name": "Sara Owner",
    "email": "sara.owner@example.com",
    "tenantId": "<tenantUuid>",
    "role": "OWNER",
    "tokenVersion": 0
  },
  "tenant": {
    "id": "<tenantUuid>",
    "name": "Demo Bistro",
    "industry": "OTHER",
    "countryCode": "BD",
    "currencyCode": "BDT"
  }
}
```

**Staff supervisor example**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "sub": "<userId>",
    "role": "SUPERVISOR",
    "tenantId": "<tenantUuid>",
    "email": "sam.supervisor@example.com",
    "name": "Sam Supervisor",
    "tokenVersion": 0
  },
  "tenant": { "id": "<tenantUuid>", "name": "Demo Bistro", "...": "..." }
}
```

**Post-login router (required)**

```ts
function routeAfterLogin(user: AuthUser) {
  if (user.role === 'ADMIN') return '/admin';
  if (user.role === 'OWNER' && !user.tenantId) return '/onboarding/create-tenant';
  if (user.role === 'OWNER') return '/owner/home';
  if (user.role === 'SUPERVISOR') return '/staff/supervisor/home'; // NOT onboarding
  if (user.role === 'MANAGER') return '/staff/manager/home';
  if (user.role === 'SERVER') return '/staff/server/home';
  if (user.role === 'KITCHEN') return '/staff/kitchen/home';
  if (user.role === 'CASHIER') return '/staff/cashier/home';
  return '/login';
}
```

#### `POST /api/auth/logout`

Unchanged. Clear local token store. Backend bumps `tokenVersion`.

#### Public POS helpers (unchanged)

- `GET /api/auth/tenants`
- `GET /api/auth/tenants/:tenantId/users`

Use for staff PIN login UI. Users list only includes ACTIVE users with **active** roles (will include OWNER and staff SUPERVISOR when present).

---

### 3.2 Tenant create & roles

#### `POST /api/tenant/create`

| | Before | After |
| --- | --- | --- |
| Auth header | Bearer JWT `role=SUPERVISOR`, no tenant | Bearer JWT **`role=OWNER`**, no tenant |
| Always creates | Role `SUPERVISOR` | Role **`OWNER`** |
| Optional flags | `manager`, `server`, `kitchen`, `cashier` | Same **+ `supervisor`** (staff) |
| Response attached user | `supervisor: {…}` | **`owner: {…}`** |

**Headers**

```http
Authorization: Bearer <ownerJwtWithoutTenantId>
Content-Type: application/json
```

**Request body**

```json
{
  "name": "Demo Bistro",
  "industry": "RESTAURANT",
  "countryCode": "BD",
  "currencyCode": "BDT",
  "subscriptionPriceId": "<uuid from GET /api/admin/subscription-prices>",
  "startWithFreeTrial": false,
  "mobileLogo": "https://...",
  "tabletLogo": "https://...",
  "manager": true,
  "supervisor": true,
  "server": true,
  "kitchen": true,
  "cashier": true
}
```

`industry` enum values:

`RESTAURANT` | `BAR` | `SUPERMARKET` | `HARDWARE_STORE` | `WINE_SHOP` | `CLOTHING_AND_FASHION_SHOP` | `BOOKSHOP` | `COSMETIC_AND_SKINCARE_SHOP` | `CONSTRUCTION_SHOP` | `OTHER`

**Response (shape)**

```json
{
  "id": "<tenantId>",
  "name": "Demo Bistro",
  "industry": "RESTAURANT",
  "countryCode": "BD",
  "currencyCode": "BDT",
  "subscriptionStatus": "PENDING",
  "status": "ACTIVE",
  "roles": [
    { "id": "...", "name": "OWNER", "tenantId": "...", "isActive": true },
    { "id": "...", "name": "MANAGER", "isActive": true }
  ],
  "owner": {
    "id": "<userId>",
    "email": "sara@example.com",
    "tenantId": "<tenantId>",
    "roleId": "<ownerRoleId>",
    "pendingRole": null,
    "role": { "name": "OWNER", "isActive": true }
  }
}
```

**Frontend / agent must:**

1. Call only if `user.role === 'OWNER'` && `!user.tenantId`.
2. Add checkbox “Enable Supervisor (staff)” → `supervisor: true`.
3. Read **`response.owner`** (break if still using `response.supervisor`).
4. Immediately **`POST /api/auth/login`** again; replace stored JWT (now has `tenantId`).
5. Then load owner home / subscription pay screen.

#### `PATCH /api/tenant/:tenantId/roles`

| | Before | After |
| --- | --- | --- |
| Who | Admin or old Supervisor | **Admin or Owner only** |
| Body | flags including `supervisor` | Same; `supervisor: true` enables **staff** SUPERVISOR |

```http
PATCH /api/tenant/<tenantId>/roles
Authorization: Bearer <ownerOrAdminJwt>

{ "manager": true, "supervisor": true, "server": true, "kitchen": true, "cashier": true }
```

- Only `true` flags upsert `isActive: true` (omitting a flag does **not** disable).
- Never send an `owner` flag — OWNER is not toggleable here.
- Staff SUPERVISOR calling this → **403** — hide UI.

#### `GET /api/tenant/:tenantId/roles`

Allowed: `owner`, `manager`, `supervisor`, `admin` (staff only for own tenant).  
List may include both `OWNER` and `SUPERVISOR` role rows.

---

### 3.3 Users / credentials

#### `POST /api/users` — create staff

```json
{
  "name": "Sam Supervisor",
  "email": "sam@example.com",
  "pin": "4444",
  "image": "https://...",
  "role": "SUPERVISOR"
}
```

`role` enum (`StaffRoleName`): `MANAGER` | `SUPERVISOR` | `SERVER` | `KITCHEN` | `CASHIER`  
(Backend uppercases string.)

**Do not** POST `role: "OWNER"`. Owner is only created via register + tenant create.

Who can create staff: `OWNER`, `MANAGER`, `SUPERVISOR` (and admin cross-tenant routes).

Prerequisite: that staff role must already be enabled (`PATCH .../roles` or create-tenant flag), else **400** `Role not found for this tenant or inactive`.

#### `PATCH /api/users/:id/reset-credentials`

| | Before | After |
| --- | --- | --- |
| Who | Old supervisor | **`OWNER` only** |
| Targets | Manager, Cashier, Server, Kitchen | Manager, **Supervisor**, Cashier, Server, Kitchen |

```json
{ "email": "new@example.com", "pin": "9999" }
```

At least one of `email` / `pin` required. After success, force that staff user to log in again.

#### Admin reset owner

| Before | After |
| --- | --- |
| `PATCH /api/users/tenant/:tenantId/:id/reset-supervisor-credentials` | **`PATCH /api/users/tenant/:tenantId/:id/reset-owner-credentials`** |

Target user must be `OWNER`.

---

### 3.4 Owner-only APIs (gate on `OWNER`)

| Method | Path | UI |
| --- | --- | --- |
| `POST` | `/api/tenant/create` | Onboarding |
| `PATCH` | `/api/tenant/:tenantId/roles` | Settings → Enable roles |
| `POST` | `/api/support` | Support create |
| `GET` | `/api/support` | Support inbox |
| `GET` | `/api/support/:id` | Support detail |
| `POST` | `/api/support/:id/messages` | Support reply |
| `POST` | `/api/uploads/image` | Image upload (+ Admin) |
| `PATCH` | `/api/users/:id/reset-credentials` | Reset staff PIN/email |

Support chat messages now persist `senderRole: "OWNER"` (was `"SUPERVISOR"`). If UI branches on `senderRole`, accept **`OWNER`**.

---

### 3.5 Shared ops (OWNER + SUPERVISOR + MANAGER)

Include **`OWNER`** wherever the old app allowed old-supervisor ops.

| Area | OWNER | Staff SUPERVISOR | MANAGER |
| --- | :---: | :---: | :---: |
| Menu / items CRUD | ✓ | ✓ | ✓ |
| Tables CRUD / menu select | ✓ | ✓ | ✓ |
| Staff CRUD | ✓ | ✓ | ✓ (no reset PIN via dedicated endpoint) |
| Orders dine-in / history | ✓ | ✓ | ✓ |
| Tickets board actions | ✓ | ✓ | ✓ |
| Cashier summary / table checkout | ✓ | ✓ | ✓ |
| Subscription pay / status | ✓ | ✓ | ✓ |
| Tenant `GET/PATCH /tenant/me` | ✓ | ✓ | ✓ |
| Overview reports | all ranges | daily/monthly | daily/monthly |

**Still cashier-only** (do **not** add SUPERVISOR):

- `POST /api/orders/cashier-direct`
- `POST /api/orders/cashier-direct-inventory`
- `POST /api/orders/:id/cashier-direct-checkout`

---

### 3.6 Inventory

| Action | Manager | Staff SUPERVISOR | OWNER |
| --- | :---: | :---: | :---: |
| Create / update / list | ✓ | ✓ | ✓ |
| `DELETE /api/inventory/:id` | Pending request | Direct delete | Direct delete |
| Approve / reject delete request | ✗ | ✓ | ✓ (+ Admin) |

**Delete responses (branch UI on `mode`)**

Owner/Supervisor direct delete:

```json
{
  "mode": "DELETED_DIRECTLY",
  "count": 1,
  "clearedPendingRequests": 0,
  "inventory": { "id": "...", "name": "..." }
}
```

Manager request:

```json
{
  "mode": "APPROVAL_REQUESTED",
  "message": "Owner or supervisor approval is required before this inventory item can be deleted.",
  "request": {
    "id": "<requestId>",
    "status": "PENDING",
    "requestedAt": "...",
    "inventory": { "id": "...", "name": "..." }
  }
}
```

Approve / reject:

- `GET /api/inventory/delete-requests`
- `POST /api/inventory/delete-requests/:requestId/approve`
- `POST /api/inventory/delete-requests/:requestId/reject`  
  Body optional: `{ "reason": "..." }`

**UI:**

- Manager: toast “Sent for approval”; keep product visible; show pending badge if list returns pending state.
- Owner/Supervisor: hard-delete confirm; inbox/queue for pending requests.

---

### 3.7 Discounts

| Action | Manager | SUPERVISOR | OWNER | Admin |
| --- | :---: | :---: | :---: | :---: |
| Create / update | ✓ draft (`isActive` forced false) | ✓ | ✓ | ✓ |
| Set `isActive: true` | ✗ **403** | ✓ | ✓ | ✓ |
| Delete | ✗ | ✓ | ✓ | ✓ |
| List / get | ✓ | ✓ | ✓ | ✓ |

```http
POST /api/discount
{ "name": "Weekend", "minimumPrice": 100, "offPrice": 10, "isActive": true }

# Manager: backend stores isActive=false even if client sent true
# Owner/Supervisor: isActive honored
```

Activate draft:

```http
PATCH /api/discount/:id
{ "isActive": true }
```

List drafts for approval queue:

```http
GET /api/discount?isActive=false
```

Checkout must only apply `isActive: true` discounts.

---

### 3.8 Reports

`GET /api/tenant/overview?range=daily&timezone=Africa/Douala`

| Role | Allowed `range` |
| --- | --- |
| `OWNER` | `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |
| `MANAGER`, `SUPERVISOR` | `daily`, `monthly` only |

Disable other ranges in UI for manager/staff supervisor (backend returns 403).

---

## 4. Feature-flag helpers (copy into app)

```ts
export function permissionsFor(role: AppRole) {
  const r = role.toUpperCase() as AppRole;
  const isOwner = r === 'OWNER';
  const isStaffSupervisor = r === 'SUPERVISOR';
  const isManager = r === 'MANAGER';
  const isAdmin = r === 'ADMIN';

  return {
    isOwner,
    isStaffSupervisor,
    isManager,
    isAdmin,

    // Owner portal
    canCreateTenant: isOwner, // and !tenantId
    canEnableRoles: isOwner || isAdmin,
    canOpenSupport: isOwner,
    canUploadImage: isOwner || isAdmin,
    canResetStaffCredentials: isOwner,
    canSeeAllReportRanges: isOwner,

    // Ops shared
    canManageOps: ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(r),
    canManageStaff: ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(r),
    canSuperviseCashier: ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(r),
    canPaySubscription: ['OWNER', 'SUPERVISOR', 'MANAGER'].includes(r),

    // Elevated staff
    canDirectDeleteInventory: ['OWNER', 'SUPERVISOR', 'ADMIN'].includes(r),
    canApproveInventoryDelete: ['OWNER', 'SUPERVISOR', 'ADMIN'].includes(r),
    canActivateDiscount: ['OWNER', 'SUPERVISOR', 'ADMIN'].includes(r),
    canDeleteDiscount: ['OWNER', 'SUPERVISOR', 'ADMIN'].includes(r),

    // Cashier-only
    canCashierDirectOrder: r === 'CASHIER',

    // Nav homes
    homePath:
      r === 'ADMIN' ? '/admin' :
      r === 'OWNER' ? '/owner' :
      r === 'SUPERVISOR' ? '/staff/supervisor' :
      r === 'MANAGER' ? '/staff/manager' :
      r === 'SERVER' ? '/staff/server' :
      r === 'KITCHEN' ? '/staff/kitchen' :
      r === 'CASHIER' ? '/staff/cashier' : '/login',
  };
}
```

---

## 5. Screen / nav map (what to show)

### Owner (`OWNER`)

Show:

- Onboarding create-tenant (if no `tenantId`)
- Enable roles
- Support
- Uploads
- Reset staff credentials
- Full reports (all ranges)
- Subscription pay
- All manager ops + inventory approve + discount activate/delete

Hide:

- Staff-only POS as primary (optional: still allow ops)
- Cashier-direct order screens as primary role home

### Staff Supervisor (`SUPERVISOR`)

Show:

- Manager-like ops (menu, tables, staff CRUD, orders, tickets)
- Inventory approve queue + direct delete
- Discount activate / delete
- Cashier supervise (table summary + checkout)
- Reports daily/monthly only
- Subscription pay (allowed by API)

Hide / 403:

- Create tenant / onboarding
- Enable roles
- Support
- Uploads
- Reset credentials
- Cashier-direct create/checkout
- Report weekly/quarterly/yearly

### Manager

Unchanged ops, **plus** UI for:

- Discount drafts (no activate)
- Inventory delete → pending (not gone)

### Admin console

- Rename reset owner API path
- Role labels: Owner vs Supervisor staff

---

## 6. Ordered implementation plan for an agent

Do in this order to avoid broken builds:

1. **Types & constants** — add `OWNER`; keep `SUPERVISOR` as staff; update unions/enums.  
2. **Global role checks** — replace owner meaning `SUPERVISOR` → `OWNER` (grep list §8).  
3. **Auth flows** — register/login routing; onboarding only for OWNER without `tenantId`.  
4. **Tenant create form** — `supervisor` flag; parse `response.owner`; force re-login.  
5. **Enable roles screen** — owner-only; include supervisor chip.  
6. **Staff create** — role picker includes SUPERVISOR.  
7. **Nav shells** — separate Owner vs Staff Supervisor layouts using §4 helpers.  
8. **Discounts** — draft/activate UX.  
9. **Inventory** — branch on `mode` from delete; approve queue for owner/supervisor.  
10. **Admin** — `reset-owner-credentials`.  
11. **i18n** — “Owner” vs “Supervisor”.  
12. **Clear tokens** after backend reset; use §10 seeds.  
13. **Run §9 acceptance tests**.

---

## 7. Frontend checklist

### Auth & routing

- [ ] Owner detection uses **`OWNER`**, not `SUPERVISOR`
- [ ] Signup copy says Owner
- [ ] After register → create tenant → **login again**
- [ ] Staff `SUPERVISOR` has its own home (not onboarding)
- [ ] `routeAfterLogin` handles missing `tenantId` for OWNER

### Navigation / flags

- [ ] Use `permissionsFor(role)` (or equivalent) for every gated screen
- [ ] Hide Enable Roles / Support / Uploads / Reset Credentials unless owner (or admin where applicable)
- [ ] Staff supervisor sees inventory approve + discount activate + cashier supervise

### Forms & payloads

- [ ] Tenant create sends optional `supervisor: true`
- [ ] Tenant create reads **`response.owner`**
- [ ] Enable roles body includes `supervisor?: boolean`
- [ ] Staff create picker includes `SUPERVISOR`
- [ ] Admin uses `reset-owner-credentials`

### Discounts / inventory

- [ ] Manager drafts only; owner/supervisor activate/delete
- [ ] Inventory UI handles `DELETED_DIRECTLY` vs `APPROVAL_REQUESTED`

### Copy / env

- [ ] Old owner label “Supervisor” → **Owner**
- [ ] New staff label **Supervisor** for `SUPERVISOR`
- [ ] Coordinate DB reset; clear secure storage; update QA accounts

---

## 8. Search-and-replace targets (app codebase)

Run greps and fix **owner-intent** usages (do **not** blindly replace every SUPERVISOR — staff role still exists):

```text
role === 'SUPERVISOR'          # if meant owner → OWNER
role === "SUPERVISOR"
roles.includes('supervisor')   # owner gates → owner
'reset-supervisor-credentials'
response.supervisor            # tenant create → response.owner
senderRole === 'SUPERVISOR'    # support bubbles → also OWNER
"Register as Supervisor"
"Supervisor dashboard"         # owner home → Owner
canResetCredentials            # actor must be OWNER
enableRoles                    # actor must be OWNER
```

Safe to keep `SUPERVISOR` where meaning is **staff** supervisor (new).

---

## 9. Acceptance tests (manual / e2e)

| # | Steps | Expected |
| --- | --- | --- |
| 1 | Register new owner | JWT `role=OWNER`, no `tenantId`; land on create-tenant |
| 2 | Create tenant with `supervisor: true` | `response.owner` present; roles include OWNER + SUPERVISOR |
| 3 | Re-login owner | JWT has `tenantId` |
| 4 | Owner enables roles / opens support / uploads | 200 |
| 5 | Owner creates staff `role: SUPERVISOR` | User can login as SUPERVISOR |
| 6 | Staff supervisor opens enable-roles / support | UI hidden; API would 403 |
| 7 | Manager deletes inventory | `mode=APPROVAL_REQUESTED`; product still listed |
| 8 | Supervisor/Owner approves delete | Product gone |
| 9 | Manager creates discount `isActive: true` | Stored inactive; needs activate |
| 10 | Supervisor/Owner PATCH `isActive: true` | Discount usable at checkout |
| 11 | Supervisor opens cashier-summary / checkout | 200 |
| 12 | Supervisor calls cashier-direct | 403 / UI hidden |
| 13 | Supervisor overview `range=weekly` | 403 / UI disabled |
| 14 | Owner overview `range=yearly` | 200 |
| 15 | Admin reset owner credentials | Uses new path; works |

---

## 10. Seed accounts (after `prisma migrate reset` + seed)

| Role | Email | PIN |
| --- | --- | --- |
| Admin | `admin@example.com` | `1234` |
| Owner | `sara.owner@example.com` | `3333` |
| Staff Supervisor | `sam.supervisor@example.com` | `4444` |
| Manager | `alice.manager@example.com` | `1111` |
| Server | `bob.server@example.com` | `2222` |

---

## 11. “If X breaks” map

| Symptom | Likely cause |
| --- | --- |
| 403 create tenant after register | Still requiring `SUPERVISOR` or wrong token |
| 403 enable roles as “supervisor” user | That user is **staff** SUPERVISOR; only OWNER |
| `response.supervisor` undefined | Use **`response.owner`** |
| Admin reset 404 | Still calling `reset-supervisor-credentials` |
| Manager discount never applies | Expected until owner/supervisor activates |
| Manager delete leaves product | Expected until approve |
| Overview weekly 403 for supervisor | Staff supervisor limited to daily/monthly |
| Stuck after create tenant | Forgot re-login; JWT still missing `tenantId` |
| Support chat wrong avatar/label | Still keying only on `senderRole === 'SUPERVISOR'` |

---

## 12. Swagger

Interactive contract: `/api/docs`  
Treat Swagger as source of truth for field names after you pull latest backend.
