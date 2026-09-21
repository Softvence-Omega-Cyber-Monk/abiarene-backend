# ABANDONED — Dual-compat OWNER plan

This document described a zero-break dual `OWNER`/`SUPERVISOR` alias strategy.

**It is superseded.** The project now uses a **DB reset hard cut**:

- `OWNER` = tenant owner (former SUPERVISOR powers)
- `SUPERVISOR` = staff role (MANAGER + elevated inventory + discount approval + cashier supervision)

See the Cursor implementation plan and updated:

- [role.md](./role.md)
- [workflows/owner.md](./workflows/owner.md)
- [workflows/supervisor.md](./workflows/supervisor.md)
- [HANDOVER.md](./HANDOVER.md)
