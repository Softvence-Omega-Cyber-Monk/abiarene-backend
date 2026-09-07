# System Workflow Diagrams

End-to-end pictures of how AbiArene runs: auth pipeline, tenant/role setup, subscription, and POS operations.

Companion docs:

- Role & permission deep-dive: [role.md](./role.md)
- Per-role API playbooks: [workflows/](./workflows/README.md)
- Ops / deployment handover: [HANDOVER.md](./HANDOVER.md)

API prefix: `/api` · Swagger: `/api/docs`

---

## 1. High-level system map

```mermaid
flowchart TB
  subgraph Clients
    AdminUI[Admin UI]
    OwnerUI[Owner / Manager / Supervisor UI]
    POS[POS devices<br/>Server / Kitchen / Cashier]
  end

  subgraph NestJS["NestJS API /api"]
    Guards["Global guards<br/>JwtAuthGuard → TenantGuard → RolesGuard"]
    Modules["Modules<br/>Auth · Tenant · Users · Inventory · Items<br/>Tables · Orders · Tickets · Payments<br/>Discount · Support · Admin · Uploads · Notifications"]
  end

  subgraph Data
    PG[(PostgreSQL<br/>multi-tenant via tenantId)]
  end

  subgraph External
    Stripe[Stripe / Paystack / …]
    Cloudinary[Cloudinary]
    SocketIO["Socket.IO /notifications"]
  end

  AdminUI --> Guards
  OwnerUI --> Guards
  POS --> Guards
  Guards --> Modules
  Modules --> PG
  Modules --> Stripe
  Modules --> Cloudinary
  Modules --> SocketIO
  Stripe -->|webhooks| Modules
```

---

## 2. Request authorization pipeline

Every non-`@Public()` request runs through three global `APP_GUARD`s registered in `src/app.module.ts`:

```mermaid
flowchart TD
  A[HTTP request] --> B{JwtAuthGuard<br/>src/common/guards/jwt-auth.guard.ts}
  B -->|@Public| Z[Handler]
  B -->|no/invalid JWT| X1[401]
  B -->|valid Bearer JWT| C[JwtStrategy.validate<br/>src/modules/auth/jwt.strategy.ts]
  C -->|tokenVersion / status / role mismatch| X1
  C -->|OK → request.user = AuthUser| D{TenantGuard<br/>src/common/guards/tenant.guard.ts}
  D -->|ADMIN| E
  D -->|@AllowWithoutTenant| E
  D -->|staff without tenantId| X2[403 Tenant not found]
  D -->|staff with tenantId| E2[TenantContextService.setTenant]
  E2 --> E
  E{RolesGuard<br/>src/common/guards/roles.guard.ts}
  E -->|no @Roles| Z
  E -->|JWT role in @Roles list| Z
  E -->|role not allowed| X3[403 Forbidden]
  Z[Controller handler]
```

| Layer | File | What it decides |
| --- | --- | --- |
| JWT | `src/common/guards/jwt-auth.guard.ts` + `src/modules/auth/jwt.strategy.ts` | Who is calling; role + `tenantId` + `tokenVersion` |
| Tenant | `src/common/guards/tenant.guard.ts` | Staff must have `tenantId` (admin bypass; `@AllowWithoutTenant` for pre-tenant supervisor) |
| Roles | `src/common/guards/roles.guard.ts` | JWT `role` must match `@Roles(...)` on the route |

Decorators: `@Public()`, `@Roles()`, `@AllowWithoutTenant()`, `@CurrentUser()` — see [role.md](./role.md).

---

## 3. Identity & role lifecycle

```mermaid
flowchart LR
  subgraph Platform
    A1[POST /api/admin/signup] --> A2[Admin row]
    A2 --> A3[Login → JWT role=ADMIN no tenantId]
  end

  subgraph Tenant owner
    S1[POST /api/auth/register] --> S2[User pendingRole=OWNER<br/>tenantId=null]
    S2 --> S3[POST /api/tenant/create]
    S3 --> S4[Tenant + Role OWNER isActive]
    S4 --> S5[User roleId + tenantId set<br/>pendingRole cleared]
    S5 --> S6[Optional PATCH roles enable<br/>MANAGER/SUPERVISOR/SERVER/KITCHEN/CASHIER]
    S6 --> S7[POST /api/users create staff]
  end

  subgraph Floor staff
    S7 --> M[MANAGER]
    S7 --> SV[SUPERVISOR]
    S7 --> SR[SERVER]
    S7 --> K[KITCHEN]
    S7 --> C[CASHIER]
  end
```

**Important:** only **OWNER** self-registers. Supervisor / Manager / Server / Kitchen / Cashier are created under an **already-enabled** tenant `Role` row (`isActive: true`). Details in [role.md](./role.md).

---

## 4. Onboarding + subscription workflow

```mermaid
sequenceDiagram
  actor Own as Owner
  participant Auth as /api/auth
  participant Tenant as /api/tenant
  participant Admin as /api/admin
  participant Pay as /api/payments
  participant DB as PostgreSQL

  Sup->>Auth: POST /register {name,email,pin}
  Auth->>DB: User pendingRole=OWNER
  Auth-->>Sup: accessToken (no tenantId)

  Sup->>Tenant: POST /create {name,industry,country,currency,subscriptionPriceId,roles?}
  Tenant->>DB: Tenant + OWNER role (+ optional staff roles)
  Tenant->>DB: attach user (roleId, tenantId)
  Tenant-->>Sup: tenant (subscriptionStatus PENDING or trial ACTIVE)

  opt Admin voucher
    Admin->>DB: SubscriptionVoucher for this tenantId
  end

  Sup->>Tenant: POST /subscription/pay {provider,currency,voucherCode?}
  Tenant->>DB: SubscriptionPayment PENDING
  Tenant-->>Sup: checkout URL / reference

  Pay->>DB: webhook marks payment COMPLETED
  Pay->>DB: tenant.subscriptionStatus = ACTIVE
```

---

## 5. Tenant role configuration workflow

How roles become usable for staff assignment:

```mermaid
flowchart TD
  Create["POST /api/tenant/create<br/>always creates OWNER Role<br/>optional manager/supervisor/server/kitchen/cashier flags"]
  Later["PATCH /api/tenant/:tenantId/roles<br/>Admin or Owner<br/>upsert staff Role rows isActive=true"]
  List["GET /api/tenant/:tenantId/roles<br/>or GET /api/tenant/all/:tenantId/roles"]
  Staff["POST /api/users<br/>requires Role name + tenantId + isActive=true"]
  Login["POST /api/auth/login<br/>JWT.role = Role.name if isActive<br/>else pendingRole"]

  Create --> List
  Later --> List
  List --> Staff
  Staff --> Login
```

If a role row is missing or `isActive=false`, staff create fails with `Role not found for this tenant or inactive`, and login fails with `Invalid email/PIN or disabled role`.

---

## 6. Staff management workflow

```mermaid
flowchart TD
  Enable[Enable Role on tenant] --> Create[POST /api/users]
  Create --> Login[Staff login]
  Login --> Work[Role-scoped APIs via @Roles]

  OwnReset[Owner<br/>PATCH /users/:id/reset-credentials] --> StaffRelogin[Staff re-login with new PIN/email]
  AdminReset[Admin<br/>PATCH /users/tenant/:tenantId/:id/reset-owner-credentials] --> OwnRelogin[Owner re-login]

  Logout[POST /api/auth/logout] --> Bump[tokenVersion++]
  Bump --> OldJWT[Old JWT rejected in JwtStrategy]
```

---

## 7. Restaurant dine-in workflow

```mermaid
stateDiagram-v2
  [*] --> AVAILABLE: table created
  AVAILABLE --> OCCUPIED: POST /orders (dine-in)
  OCCUPIED --> OCCUPIED: send-to-kitchen / bump / archive

  state Order {
    [*] --> CONFIRMED
    CONFIRMED --> PREPARING: send-to-kitchen
    PREPARING --> READY: bump-to-ready
    READY --> COMPLETED: force-archive
    CONFIRMED --> CANCELLED: cancel
  }

  state Ticket {
    [*] --> ACTIVE: created with send-to-kitchen
    ACTIVE --> READY: bump-to-ready
    READY --> ARCHIVED: force-archive
  }

  OCCUPIED --> AVAILABLE: cashier-checkout
```

Actors by step:

| Step | Typical roles |
| --- | --- |
| Create menu / tables | Supervisor, Manager |
| Create order | Server, Manager, Supervisor, Cashier |
| Send to kitchen | Server, Manager, Supervisor, Cashier |
| Kitchen board / bump ready | Kitchen (+ Manager/Supervisor; Cashier can bump) |
| Archive ticket | Server, Kitchen, Manager, Supervisor, Cashier |
| Table checkout | Cashier, Manager, Supervisor |

---

## 8. Cashier direct-sale workflow

```mermaid
flowchart TD
  A[POST /orders/cashier-direct<br/>or cashier-direct-inventory] --> B{Needs kitchen?}
  B -->|yes| C[send-to-kitchen → bump → archive]
  B -->|no| D[POST /orders/:id/cashier-direct-checkout]
  C --> D
  D --> E[Payment COMPLETED<br/>inventory decremented if inventory order<br/>order COMPLETED]
```

`tableId` stays `null`. Never use `/tables/:id/cashier-checkout` for direct orders.

---

## 9. Inventory deletion approval workflow

```mermaid
flowchart LR
  M[Manager DELETE /inventory/:id] --> P[PENDING InventoryDeletionRequest]
  P --> S{Owner / Supervisor / Admin}
  S -->|approve| D[Product deleted]
  S -->|reject| R[Product kept, request REJECTED]
  OwnDel[Owner or Supervisor DELETE /inventory/:id] --> D2[Product deleted immediately]
```

---

## 10. Realtime notification workflow

```mermaid
sequenceDiagram
  participant Actor as Staff action
  participant API as REST API
  participant GW as Socket.IO /notifications
  participant Client as Logged-in clients

  Actor->>API: e.g. send-to-kitchen
  API->>API: persist Notification
  API->>GW: emit notification:new to user rooms
  GW-->>Client: notification:new
  Client->>API: refetch orders/tickets/tables
```

Auth for socket: JWT in `auth.token` (preferred). Same `tokenVersion` / active checks as HTTP.

---

## 11. Role access at a glance

| Capability | ADMIN | OWNER | SUPERVISOR | MANAGER | SERVER | KITCHEN | CASHIER |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Platform plans / vouchers / all tenants | ✓ | | | | | | |
| Register + create tenant | | ✓ | | | | | |
| Enable tenant roles | ✓ | ✓ | | | | | |
| Create staff | ✓* | ✓ | ✓ | ✓ | | | |
| Reset staff credentials | owner only* | floor + supervisor | | | | | |
| Reports (all ranges) | | ✓ | daily/monthly | daily/monthly | | | |
| Subscription pay | | ✓ | ✓ | ✓ | | | |
| Menu / tables CRUD | ✓* | ✓ | ✓ | ✓ | patch table | | |
| Inventory delete immediate | | ✓ | ✓ | | | | |
| Inventory delete request | | | | ✓ | | | |
| Discount activate | | ✓ | ✓ | draft only | | | |
| Dine-in orders | | ✓ | ✓ | ✓ | ✓ | | ✓ |
| Kitchen board | | ✓ | ✓ | ✓ | | ✓ | |
| Direct checkout | | | | | | | ✓ |
| Support tickets | reply/close | create/chat | | | | | |

\*Admin uses cross-tenant routes under `/users/tenant/:tenantId`, `/items/tenant/:tenantId`, `/tables/tenant/:tenantId`.

Full decorator-level matrix and role-config APIs: **[role.md](./role.md)**.
