# AbiArene Restaurant POS SaaS Backend

Production-ready multi-tenant backend built with NestJS, Prisma, PostgreSQL, JWT auth, role authorization, and Socket.IO notifications.

## Stack

- NestJS modular architecture
- PostgreSQL + Prisma ORM
- JWT auth (PIN login)
- Swagger at `/api/docs`
- Class-validator for DTO validation
- Socket.IO websocket notifications

## Multi-Tenancy

- Shared DB with `tenantId` in tenant-owned entities
- JWT payload includes `tenantId`
- Global guards:
  - `JwtAuthGuard`
  - `TenantGuard`
  - `RolesGuard`
- Service-level tenant filters enforced on all tenant-scoped queries

## Modules

- `auth`, `users`, `roles`, `tenant`, `inventory`, `menu`, `tables`
- `orders`, `tickets`, `payments`, `discount`, `devices`
- `notifications`, `support`, `admin`

## Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
pnpm start:dev
```

## Useful Commands

```bash
pnpm build
pnpm lint
pnpm test
```

## Seed Credentials

- Manager PIN: `1111`
- Server PIN: `2222`

## API Docs

- Swagger: `http://localhost:3000/api/docs`

## WebSocket

- Namespace: `/notifications`
- Events:
  - `kitchen-ready`
  - `table-update`
