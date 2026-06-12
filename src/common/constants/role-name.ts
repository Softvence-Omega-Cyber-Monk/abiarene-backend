export enum RoleName {
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  SERVER = 'SERVER',
  KITCHEN = 'KITCHEN',
  CASHIER = 'CASHIER',
  ADMIN = 'ADMIN',
}

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

export enum StaffRoleName {
  MANAGER = RoleName.MANAGER,
  SUPERVISOR = RoleName.SUPERVISOR,
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}
