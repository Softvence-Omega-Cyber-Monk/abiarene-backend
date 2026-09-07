# Roles & Permissions (`role.md`)

How tenant roles and platform admin permissions are modeled, configured, enforced, and exposed through APIs in AbiArene.

**Current model (DB-reset cutover):**

| Role | Meaning |
| --- | --- |
| `OWNER` | Tenant owner (former SUPERVISOR powers): register, create tenant, enable roles, support, uploads, credential reset, full reports, inventory/discount approval |
| `SUPERVISOR` | Staff: same as MANAGER + elevated inventory + discount activation/delete + cashier supervision |
| `MANAGER` | Day-to-day ops; inventory delete → pending request; discount drafts only (`isActive` forced false) |

Related:

- Diagrams: [system-workflow.md](./system-workflow.md)
- Per-role playbooks: [workflows/](./workflows/README.md)
- Abandoned dual-compat plan: [owner-role-implementation-plan.md](./owner-role-implementation-plan.md)

---

## Table of contents

1. [Role model](#1-role-model)
2. [Source files map](#2-source-files-map)
3. [Decorators](#3-decorators)
4. [Global guards & JWT](#4-global-guards--jwt)
5. [How tenant roles are configured](#5-how-tenant-roles-are-configured)
6. [Role-configuration APIs (full detail)](#6-role-configuration-apis-full-detail)
7. [Staff assignment APIs (full detail)](#7-staff-assignment-apis-full-detail)
8. [Auth APIs that carry role into JWT](#8-auth-apis-that-carry-role-into-jwt)
9. [Permission matrix (every module)](#9-permission-matrix-every-module)
10. [Extra in-handler / service checks](#10-extra-in-handler--service-checks)
11. [Failure modes](#11-failure-modes)

---

## 1. Role model

### 1.1 Two identity stores

| Identity | Prisma model | Table | Has `tenantId`? | JWT `role` |
| --- | --- | --- | --- | --- |
| Platform admin | `Admin` | `admins` | No | `ADMIN` |
| Tenant staff | `User` + `Role` | `users` + `roles` | Yes (after attach) | `OWNER` / `SUPERVISOR` / `MANAGER` / `SERVER` / `KITCHEN` / `CASHIER` |

Schema: `prisma/schema.prisma`

```prisma
enum RoleName {
  MANAGER
  SUPERVISOR
  OWNER
  SERVER
  KITCHEN
  CASHIER
  ADMIN
}
```

`OWNER` is always created on tenant create. Staff `SUPERVISOR` is optional via enable-roles / create-tenant flags.

### 1.2 TypeScript enums

File: `src/common/constants/role-name.ts`

| Enum | Values | Used for |
| --- | --- | --- |
| `RoleName` | ADMIN + all staff | Guards, JWT, comparisons |
| `TenantRoleName` / `OptionalTenantRoleName` | Staff only | Tenant role flags |
| `StaffRoleName` | MANAGER, SUPERVISOR, SERVER, KITCHEN, CASHIER | `CreateUsersDto.role` |

`ADMIN` is **not** a tenant `Role` row. Admins never get a `roles` record under a tenant.

### 1.3 `pendingRole` vs `Role.isActive`

| State | `User.pendingRole` | `User.roleId` / `Role` | Can login? | Can call tenant APIs? |
| --- | --- | --- | --- | --- |
| Just registered owner | `OWNER` | null | Yes | Only `@AllowWithoutTenant` routes (e.g. create tenant, upload) |
| Owner after tenant create | null | OWNER role active | Yes | Full owner APIs |
| Staff under enabled role (incl. SUPERVISOR) | null | role active | Yes | Per `@Roles` |
| Staff whose `Role.isActive=false` | — | inactive | **No** (unless pendingRole set) | No |

Login / JWT resolve role as:

```ts
const role = user.role?.isActive ? user.role.name : user.pendingRole;
```

(Files: `src/modules/auth/auth.service.ts`, `src/modules/auth/jwt.strategy.ts`)

---

## 2. Source files map

| Concern | Path |
| --- | --- |
| Role enums | `src/common/constants/role-name.ts` |
| `@Roles` | `src/common/decorators/roles.decorator.ts` |
| `@Public` | `src/common/decorators/public.decorator.ts` |
| `@AllowWithoutTenant` | `src/common/decorators/allow-without-tenant.decorator.ts` |
| `@CurrentUser` | `src/common/decorators/current-user.decorator.ts` |
| `AuthUser` shape | `src/common/interfaces/auth-user.interface.ts` |
| `JwtAuthGuard` | `src/common/guards/jwt-auth.guard.ts` |
| `TenantGuard` | `src/common/guards/tenant.guard.ts` |
| `RolesGuard` | `src/common/guards/roles.guard.ts` |
| `TenantContextService` | `src/common/context/tenant-context.service.ts` |
| Guard registration order | `src/app.module.ts` |
| JWT validate | `src/modules/auth/jwt.strategy.ts` |
| Register / login | `src/modules/auth/auth.service.ts`, `auth.controller.ts`, `auth.dto.ts` |
| Create tenant + roles | `src/modules/tenant/tenant.service.ts` (`createForOwner`, `updateRoles`, `listRoles`) |
| Role HTTP routes | `src/modules/tenant/controllers/tenant-portal.controller.ts`, `admin-tenant.controller.ts` |
| Role DTOs | `src/modules/tenant/tenant.dto.ts` (`CreateTenantDto`, `UpdateTenantRolesDto`, …) |
| Staff CRUD | `src/modules/users/users.service.ts`, `users.controller.ts`, `users.dto.ts` |
| Prisma models | `prisma/schema.prisma` |
| Seed roles/users | `prisma/seed.mjs` |

---

## 3. Decorators

### 3.1 `@Public()`

```ts
// src/common/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

**Effect:** `JwtAuthGuard`, `TenantGuard`, and `RolesGuard` all skip the route. No JWT required.

**Used on:** login, register, admin signup, public plan list, auth tenant/user lookup, payment callbacks/webhooks, health `GET /`.

### 3.2 `@Roles(...roles: string[])`

```ts
// src/common/decorators/roles.decorator.ts
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**Effect:** `RolesGuard` lowercases both the decorator values and `request.user.role`, then checks inclusion.

```ts
@Roles('manager', 'supervisor', 'owner')
```

JWT may carry `OWNER` or `MANAGER`; comparison is case-insensitive.

**If `@Roles` is omitted:** any authenticated user that passed JWT + Tenant guards is allowed (e.g. many `GET` inventory/table list routes, payment CRUD, notifications).

### 3.3 `@AllowWithoutTenant()`

```ts
// src/common/decorators/allow-without-tenant.decorator.ts
export const ALLOW_WITHOUT_TENANT_KEY = 'allowWithoutTenant';
export const AllowWithoutTenant = () => SetMetadata(ALLOW_WITHOUT_TENANT_KEY, true);
```

**Effect:** `TenantGuard` does not require `user.tenantId`.

**Used on:**

- `POST /api/tenant/create` — owner before tenant exists  
- `POST /api/uploads/image` — admin/owner upload (admin already bypasses tenant; owner may still be pre-tenant)

### 3.4 `@CurrentUser()`

```ts
// src/common/decorators/current-user.decorator.ts
// returns request.user as AuthUser
```

```ts
// src/common/interfaces/auth-user.interface.ts
export interface AuthUser {
  sub: string;
  name?: string;
  email?: string;
  tenantId?: string;
  role: string;
  tokenVersion?: number;
}
```

Controllers typically do `this.tenantId(user)` and throw if missing for staff-scoped handlers.

---

## 4. Global guards & JWT

### 4.1 Registration order

`src/app.module.ts`:

```ts
{ provide: APP_GUARD, useClass: JwtAuthGuard },
{ provide: APP_GUARD, useClass: TenantGuard },
{ provide: APP_GUARD, useClass: RolesGuard },
```

Order matters: identity → tenant isolation → role allow-list.

### 4.2 `JwtAuthGuard`

File: `src/common/guards/jwt-auth.guard.ts`

- Reads `IS_PUBLIC_KEY`; if public → allow.
- Else Passport `jwt` strategy (`Authorization: Bearer <token>`).

### 4.3 `JwtStrategy.validate`

File: `src/modules/auth/jwt.strategy.ts`

| Step | Behavior |
| --- | --- |
| Role is ADMIN | Load `Admin` by `sub`, status ACTIVE, match `tokenVersion` → `{ sub, email, role: ADMIN, tokenVersion }` (no tenantId) |
| Staff | Load `User` ACTIVE, include `role`; match `tenantId` in payload vs DB; match `tokenVersion`; resolve role = active Role.name or `pendingRole`; payload.role must equal resolved role |
| Failures | `UnauthorizedException` (revoked token, inactive, role mismatch, etc.) |

### 4.4 `TenantGuard`

File: `src/common/guards/tenant.guard.ts`

| Condition | Result |
| --- | --- |
| `@Public` | pass |
| No `request.user` | 401 |
| `role === ADMIN` | pass (bypass tenant) |
| `@AllowWithoutTenant` | pass |
| Staff missing `tenantId` | 403 `Tenant not found in token` |
| Staff with `tenantId` | `TenantContextService.setTenant(tenantId)` then pass |

### 4.5 `RolesGuard`

File: `src/common/guards/roles.guard.ts`

| Condition | Result |
| --- | --- |
| `@Public` | pass |
| No `@Roles` metadata | pass (authenticated + tenant OK) |
| User role in required list | pass |
| Else | fail (Nest returns 403) |

There is also `src/common/guards/admin-auth.guard.ts` / admin JWT strategy leftovers — **not** registered as global APP_GUARD. Production path is the shared JWT + `@Roles('admin')` or manual `user.role === ADMIN` checks.

---

## 5. How tenant roles are configured

Roles are **not** free-form strings on the user. Flow:

```text
1. Role row exists for (tenantId, name) with isActive=true
2. User is created with roleId pointing at that row
3. Login/JWT emit Role.name
4. @Roles on routes allow/deny that name
```

### 5.1 When role rows are created

**A. Tenant create** — `TenantService.createForOwner`  
File: `src/modules/tenant/tenant.service.ts`

- Always creates `OWNER` with `isActive: true`.
- Optional body flags `manager`, `supervisor`, `server`, `kitchen`, `cashier` each add an active staff role.
- Attaches the creating user: `roleId`, `tenantId`, `pendingRole: null`.

**B. Later enable** — `TenantService.updateRoles`  
Same file. Upserts each `true` flag to `{ isActive: true }` (create if missing). Never creates/toggles OWNER.

**Note:** `updateRoles` only **enables** (`isActive: true`). It does not set `isActive: false` when a flag is omitted/false. Disabling a role is not exposed as a dedicated API today; inactive roles block login/staff create via `isActive` checks.

### 5.2 When staff can be assigned

`UsersService.validateRole` (`src/modules/users/users.service.ts`):

```ts
where: { name: roleName, tenantId, isActive: true }
```

If missing → `400 Role not found for this tenant or inactive`.

### 5.3 Who can configure roles

| Actor | How |
| --- | --- |
| Owner | On create tenant flags; later `PATCH /api/tenant/:tenantId/roles` |
| Admin | Same PATCH; also list via `/tenant/all/:tenantId/roles` |
| Manager / Supervisor / Server / Kitchen / Cashier | Cannot enable roles |

---

## 6. Role-configuration APIs (full detail)

### 6.1 Create tenant (creates OWNER + optional staff roles)

| | |
| --- | --- |
| **Method / path** | `POST /api/tenant/create` |
| **Controller** | `src/modules/tenant/controllers/tenant-portal.controller.ts` |
| **Service** | `src/modules/tenant/services/tenant-portal.service.ts` → `tenant.service.ts#createForOwner` |
| **DTO** | `CreateTenantDto` in `src/modules/tenant/tenant.dto.ts` |
| **Decorators** | `@AllowWithoutTenant()` `@Roles('owner')` |
| **Auth** | Bearer JWT of registered owner **without** tenant yet |

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

| Field | Required | Impact on roles |
| --- | --- | --- |
| `name`, `countryCode`, `currencyCode`, `subscriptionPriceId` | Yes | Tenant row |
| `industry` | No (default `OTHER`) | Tenant metadata |
| `startWithFreeTrial` | No | Subscription ACTIVE 7 days vs PENDING |
| `manager` / `supervisor` / `server` / `kitchen` / `cashier` | No | If `true`, creates matching staff `Role` with `isActive: true` |
| — | — | `OWNER` role **always** created |

**Success response (shape)** — tenant + nested `roles[]` + `owner` user with `roleId`/`tenantId` set, `pendingRole` null.

**Impact**

- Owner JWT from register still has **no** `tenantId` until they **login again** (or client refreshes token). After create, call `POST /api/auth/login` to get JWT with `tenantId`.
- Staff for optional roles can now be created via `POST /api/users`.
- Tenant `subscriptionStatus` is `PENDING` or trial `ACTIVE`.

**Errors**

| Status | When |
| --- | --- |
| 403 | Caller not OWNER / already has tenant |
| 400 | Invalid price missing; email issues upstream |
| 404 | Owner user missing |

---

### 6.2 Enable roles on an existing tenant

| | |
| --- | --- |
| **Method / path** | `PATCH /api/tenant/:tenantId/roles` |
| **Controller** | `src/modules/tenant/controllers/admin-tenant.controller.ts` |
| **Service** | `admin-tenant.service.ts` → `tenant.service.ts#updateRoles` |
| **DTO** | `UpdateTenantRolesDto` |
| **Decorators** | None (`@Roles` not used) — **manual check** inside handler |
| **Who** | `ADMIN` or `OWNER` only |

**Manual permission code**

```ts
const role = user?.role?.toUpperCase();
if (role !== RoleName.ADMIN && role !== RoleName.OWNER) {
  throw new ForbiddenException('This route is for admin or owner only');
}
```

**Request body**

```json
{
  "manager": true,
  "supervisor": true,
  "server": true,
  "kitchen": true,
  "cashier": true
}
```

Only flags set to `true` are upserted to `isActive: true`. Omitting a flag does **not** disable that role. Enabling `supervisor` creates the **staff** SUPERVISOR role (not the tenant owner).

**Success response** — array of all `Role` rows for the tenant:

```json
[
  {
    "id": "...",
    "name": "MANAGER",
    "tenantId": "...",
    "isActive": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

**Impact**

- New role names become assignable in `POST /api/users`.
- Users already linked to a role keep working if that role stays active.
- Enabling `supervisor` again is idempotent upsert for staff SUPERVISOR.

**Errors**

| Status | When |
| --- | --- |
| 403 | Not admin/owner |
| 404 | Tenant missing (`ensureTenantExists`) |

---

### 6.3 List roles (own tenant / admin)

#### A. Shared list (manager, supervisor, owner, admin)

| | |
| --- | --- |
| **Method / path** | `GET /api/tenant/:tenantId/roles?page=1&limit=20` |
| **Controller** | `tenant-portal.controller.ts` |
| **Decorators** | `@Roles('manager', 'supervisor', 'owner', 'admin')` |
| **Extra check** | Non-admin must have `user.tenantId === :tenantId` |

**Response** — paginated roles:

```json
{
  "data": [ { "id": "...", "name": "SERVER", "tenantId": "...", "isActive": true, ... } ],
  "meta": { "page": 1, "limit": 20, "total": 5, ... }
}
```

**Impact** — read-only; used by UI to show which roles exist before creating staff.

#### B. Admin cross-tenant list

| | |
| --- | --- |
| **Method / path** | `GET /api/tenant/all/:tenantId/roles?page=&limit=` |
| **Controller** | `admin-tenant.controller.ts` |
| **Who** | Admin only (manual check) |

Same list payload, any tenant.

---

## 7. Staff assignment APIs (full detail)

Staff creation is how a configured role becomes a login identity.

### 7.1 Create staff (tenant scope)

| | |
| --- | --- |
| **Method / path** | `POST /api/users` |
| **Controller** | `src/modules/users/users.controller.ts` |
| **Service** | `users.service.ts#createForTenant` |
| **DTO** | `CreateUsersDto` (`users.dto.ts`) |
| **Decorators** | `@Roles('manager', 'supervisor')` |

**Request body**

```json
{
  "name": "Bob Server",
  "email": "bob.server@example.com",
  "pin": "2222",
  "image": "https://...",
  "role": "SERVER"
}
```

| Field | Rules |
| --- | --- |
| `name` | 2–80 chars |
| `email` | unique across `users` and `admins` |
| `pin` | optional, exactly 4 digits |
| `role` | enum `StaffRoleName` (uppercased by `@Transform`) |
| `image` | optional URL |

**Success** — created `User` row with `roleId` + `tenantId` from JWT.

**Impact**

- User can `POST /api/auth/login` and receive JWT with that role + `tenantId`.
- Public POS UI can list them via `GET /api/auth/tenants/:tenantId/users` (only ACTIVE users with active roles).

**Errors**

| Status | Message / cause |
| --- | --- |
| 400 | Email already exists |
| 400 | Role not found for this tenant or inactive |
| 403 | Caller not manager/supervisor |

### 7.2 Admin create staff (cross-tenant)

| | |
| --- | --- |
| **Method / path** | `POST /api/users/tenant/:tenantId` |
| **Decorators** | `@Roles('admin')` |
| **Body** | Same `CreateUsersDto` |
| **Impact** | Same as above, for any tenant |

### 7.3 Update / delete / reset (permission differences)

| Method | Path | `@Roles` | Extra rules | Impact |
| --- | --- | --- | --- | --- |
| `GET` | `/api/users` | manager, supervisor, owner | — | List staff |
| `GET` | `/api/users/:id` | manager, supervisor, owner | — | One staff |
| `PATCH` | `/api/users/:id` | manager, supervisor, owner | Manager **cannot** change `email`/`pin` (service throws 400) | Update profile/role/status |
| `PATCH` | `/api/users/:id/reset-credentials` | **owner** | Target must be MANAGER/SUPERVISOR/CASHIER/SERVER/KITCHEN | Sets email and/or pin |
| `DELETE` | `/api/users/:id` | manager, supervisor, owner | — | Deletes user |
| `PATCH` | `/api/users/tenant/:tenantId/:id/reset-owner-credentials` | **admin** | Target must be OWNER | Reset owner credentials |
| `GET/PATCH` | `/api/users/me` | all staff roles + owner | Own profile only | Self-service |

**Reset credentials body** (`ResetUserCredentialsDto`):

```json
{ "email": "new@example.com", "pin": "9999" }
```

At least one of `email` or `pin` required.

**Note:** current `resetUserCredentialsForRoles` updates email/pin but does **not** increment `tokenVersion`. Logout does. Clients should still force re-login after a credential change.

---

## 8. Auth APIs that carry role into JWT

### 8.1 Register owner

| | |
| --- | --- |
| **Path** | `POST /api/auth/register` |
| **File** | `auth.controller.ts` / `auth.service.ts#registerOwner` |
| **Access** | `@Public()` |
| **Body** | `{ "name", "email", "pin" }` (`RegisterOwnerDto`) |

**Response**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "sub": "<userId>",
    "name": "...",
    "email": "...",
    "role": "OWNER",
    "tokenVersion": 0
  }
}
```

No `tenantId`. DB: `pendingRole=OWNER`.

**Impact:** can call `POST /api/tenant/create` and `POST /api/uploads/image` only among tenant-gated routes (via `@AllowWithoutTenant`).

### 8.2 Login

| | |
| --- | --- |
| **Path** | `POST /api/auth/login` |
| **Access** | `@Public()` |
| **Body** | `{ "email", "pin" }` |

**Admin hit first** → JWT `{ sub, email, role: "ADMIN", tokenVersion }`  
**Else staff** → JWT `{ sub, name, email, tenantId?, role, tokenVersion }` + optional `tenant` object in response.

**Impact:** every subsequent permission check uses this `role` string.

### 8.3 Logout

| | |
| --- | --- |
| **Path** | `POST /api/auth/logout` |
| **Access** | Any authenticated user |
| **Impact** | `tokenVersion++` on Admin or User → old JWT fails in `JwtStrategy` |

### 8.4 Public POS helpers

| Path | Access | Purpose |
| --- | --- | --- |
| `GET /api/auth/tenants` | Public | ACTIVE tenants for login UI |
| `GET /api/auth/tenants/:tenantId/users` | Public | ACTIVE users whose **role.isActive** |

---

## 9. Permission matrix (every module)

Legend: **✓** allowed by `@Roles` or intentional open-to-auth · **—** not allowed · **\*** admin cross-tenant path · **M** manual in-handler check · **T** tenant context required · **P** `@Public`

### 9.1 Auth / Admin / Tenant portal

| Endpoint | Admin | Own | Sup | Mgr | Srv | Kit | Cash | Notes |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| `POST /auth/register` | P | P | P | P | P | P | P | Creates owner only |
| `POST /auth/login` | P | P | P | P | P | P | P | |
| `POST /auth/logout` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Any JWT |
| `POST /admin/signup` | P | | | | | | | |
| `GET /admin/me` `GET /admin/dashboard` | ✓ | — | — | — | — | — | — | |
| Subscription prices CUD | ✓ | — | — | — | — | — | — | List GET is Public |
| Subscription vouchers CRUD | ✓ | — | — | — | — | — | — | |
| `GET /tenant/all` | M | — | — | — | — | — | — | |
| `PATCH /tenant/:id/status` | M | — | — | — | — | — | — | |
| `PATCH /tenant/:id/roles` | M | M | — | — | — | — | — | Owner or Admin |
| `POST /tenant/create` | — | ✓ | — | — | — | — | — | AllowWithoutTenant |
| `GET/PATCH /tenant/me` | — | ✓ | ✓ | ✓ | ✓* | ✓* | ✓* | *GET only for floor |
| Overview / reports | — | ✓ | ✓ | ✓ | — | — | — | Owner all ranges; Mgr/Sup daily/monthly |
| Subscription pay / status | — | ✓ | ✓ | ✓ | — | — | — | |
| `GET /tenant/:id/roles` | ✓ | ✓ | ✓ | ✓ | — | — | — | Own tenant for staff |

### 9.2 Users

| Endpoint | Admin | Own | Sup | Mgr | Srv | Kit | Cash |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `POST/GET/PATCH/DELETE /users` … | — | ✓ | ✓ | ✓ | — | — | — |
| `PATCH /users/:id/reset-credentials` | — | ✓ | — | — | — | — | — |
| `GET/PATCH /users/me` | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/users/tenant/:tenantId`… | ✓* | — | — | — | — | — | — |
| reset-owner-credentials | ✓* | — | — | — | — | — | — |

### 9.3 Inventory / Items / Tables / Orders / Tickets

| Endpoint group | Admin | Own | Sup | Mgr | Srv | Kit | Cash | Notes |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | --- |
| Inventory mutate | ✓ | ✓ | ✓ | ✓ | — | — | — | Manager delete → request |
| Inventory delete approve/reject | ✓ | ✓ | ✓ | — | — | — | — | |
| Inventory GET list | T | T | T | T | T | T | T | No `@Roles` → any staff+tenant |
| Items CRUD | — | ✓ | ✓ | ✓ | — | — | — | Admin via `/items/tenant/:id`* |
| Tables CRUD / menu | — | ✓ | ✓ | ✓ | — | — | — | Admin via `/tables/tenant/:id`* |
| `PATCH /tables/:id` | — | ✓ | ✓ | ✓ | ✓ | — | — | |
| Cashier summary/checkout | — | ✓ | ✓ | ✓ | — | — | ✓ | |
| `POST /orders` dine-in | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | |
| Order patch/delete/cancel | — | ✓ | ✓ | ✓ | ✓ | — | — | |
| send-to-kitchen | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | |
| cashier-direct* | — | — | — | — | — | — | ✓ | |
| Tickets list / get | — | ✓ | ✓ | ✓ | ✓ | ✓ | — | |
| kitchen-board | — | ✓ | ✓ | ✓ | — | ✓ | — | |
| bump-to-ready | — | ✓ | ✓ | ✓ | — | ✓ | ✓ | |
| force-archive | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |

### 9.4 Discount / Payments / Support / Uploads / Notifications

| Endpoint group | Admin | Own | Sup | Mgr | Srv | Kit | Cash |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Discount draft create/update | ✓ | ✓ | ✓ | ✓ | — | — | — | Mgr forced inactive |
| Discount activate/delete | ✓ | ✓ | ✓ | — | — | — | — | |
| Discount GET | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Payments CRUD | T | T | T | T | T | T | T | No `@Roles` |
| Payment webhooks/callbacks | P | P | P | P | P | P | P | |
| Support create/messages | — | ✓ | — | — | — | — | — | |
| Support list/get | ✓ | ✓ | — | — | — | — | — | |
| Support status | ✓ | — | — | — | — | — | — | |
| Upload image | ✓ | ✓ | — | — | — | — | — | AllowWithoutTenant |
| Notifications inbox | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | Any JWT |

---

## 10. Extra in-handler / service checks

`@Roles` is not the only gate. Business logic adds role-aware behavior:

| Location | Rule |
| --- | --- |
| `admin-tenant.controller.ts` | Admin-only / admin-or-owner without `@Roles` |
| `tenant-portal.controller.ts` `listRoles` | Non-admin cannot list another tenant’s roles |
| `tenant-portal.controller.ts` overview | Manager and staff supervisor limited to `daily` / `monthly` |
| `users.service.ts#updateForTenant` | Manager cannot set email/pin |
| `users.service.ts#resetStaffCredentials` | Owner actor; targets MANAGER/SUPERVISOR/CASHIER/SERVER/KITCHEN |
| `users.service.ts#resetOwnerCredentials` | Admin; only OWNER targets |
| `users.service.ts#validateRole` | Role must exist + `isActive` |
| `inventory.service.ts#delete` | OWNER or SUPERVISOR deletes immediately; MANAGER creates PENDING request |
| `discount.service.ts` | Manager cannot set `isActive: true` |
| `jwt.strategy.ts` / `auth.service.ts` | Inactive role blocks auth unless `pendingRole` |

Always filter tenant-owned data by `tenantId` from the JWT (handover rule). Admin cross-tenant routes take `:tenantId` from the path instead.

---

## 11. Failure modes

| Symptom | Likely cause | Where |
| --- | --- | --- |
| 401 on every call | Missing/invalid JWT or revoked `tokenVersion` | JwtAuthGuard / JwtStrategy |
| 403 `Tenant not found in token` | Owner registered but not re-logged after tenant create; or admin token on staff-only route expecting tenant | TenantGuard |
| 403 Forbidden on route | Role not in `@Roles` list | RolesGuard |
| 400 Role not found or inactive | Creating user before `PATCH .../roles` or create-tenant flag | UsersService.validateRole |
| Login fails after role disable | `Role.isActive=false` and no `pendingRole` | AuthService.login |
| Manager cannot change staff PIN | Explicit service rule | UsersService.updateForTenant |
| Inventory still visible after manager delete | Pending deletion request awaiting owner/supervisor | InventoryService.delete |

---

## Quick reference: configure a new floor role end-to-end

```text
1. Owner logged in with tenantId JWT
2. PATCH /api/tenant/:tenantId/roles
   { "cashier": true }
3. POST /api/users
   { "name": "Casey", "email": "casey@example.com", "pin": "4444", "role": "CASHIER" }
4. Cashier: POST /api/auth/login
5. Cashier calls only routes decorated with @Roles(..., 'cashier') or open authenticated routes
```

That is the full tenant-role configuration and permission path used by this project.
