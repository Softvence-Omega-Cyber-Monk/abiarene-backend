export enum RoleName {
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  OWNER = 'OWNER',
  SERVER = 'SERVER',
  KITCHEN = 'KITCHEN',
  CASHIER = 'CASHIER',
  ADMIN = 'ADMIN',
}

/** Optional staff roles that can be enabled on a tenant (OWNER is always created). */
export enum TenantRoleName {
  MANAGER = RoleName.MANAGER,
  SUPERVISOR = RoleName.SUPERVISOR,
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}

export enum OptionalTenantRoleName {
  MANAGER = RoleName.MANAGER,
  SUPERVISOR = RoleName.SUPERVISOR,
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}

/** Roles assignable when creating staff under a tenant. */
export enum StaffRoleName {
  MANAGER = RoleName.MANAGER,
  SUPERVISOR = RoleName.SUPERVISOR,
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}

export function normalizeRole(role?: string | null): string | undefined {
  return role?.toUpperCase();
}

export function isOwnerRole(role?: string | null): boolean {
  return normalizeRole(role) === RoleName.OWNER;
}

export function canDirectDeleteInventory(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === RoleName.OWNER || r === RoleName.SUPERVISOR || r === RoleName.ADMIN;
}

export function canApproveDiscount(role?: string | null): boolean {
  const r = normalizeRole(role);
  return r === RoleName.OWNER || r === RoleName.SUPERVISOR || r === RoleName.ADMIN;
}

export function isElevatedInventoryApprover(role?: string | null): boolean {
  return canDirectDeleteInventory(role);
}
