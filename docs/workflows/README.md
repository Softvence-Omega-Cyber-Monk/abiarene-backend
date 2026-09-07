# AbiArene Role Workflows

Role-by-role API and business-flow guides for the AbiArene POS backend.

API prefix: `/api` · Auth: JWT Bearer · Full DTO contract: `/api/docs`

| Role | Doc | How they enter the system |
| --- | --- | --- |
| **ADMIN** | [admin.md](./admin.md) | `POST /api/admin/signup` or seed |
| **OWNER** | [owner.md](./owner.md) | Self-register → create tenant → subscribe |
| **SUPERVISOR** | [supervisor.md](./supervisor.md) | Created by Owner/Manager/Admin (staff) |
| **MANAGER** | [manager.md](./manager.md) | Created by Owner/Manager/Admin |
| **SERVER** | [server.md](./server.md) | Created by Owner/Manager/Admin |
| **KITCHEN** | [kitchen.md](./kitchen.md) | Created by Owner/Manager/Admin |
| **CASHIER** | [cashier.md](./cashier.md) | Created by Owner/Manager/Admin |

Related:

- [system-workflow.md](../system-workflow.md) — system diagrams
- [role.md](../role.md) — how roles are configured & enforced
- [HANDOVER.md](../HANDOVER.md)
