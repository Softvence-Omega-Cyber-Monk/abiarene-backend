export enum RoleName {
  MANAGER = 'manager',
  SERVER = 'server',
  KITCHEN = 'kitchen',
  CASHIER = 'cashier',
  ADMIN = 'admin',
}

export enum TenantRoleName {
  MANAGER = RoleName.MANAGER,
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}

export enum OptionalTenantRoleName {
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}

export enum StaffRoleName {
  SERVER = RoleName.SERVER,
  KITCHEN = RoleName.KITCHEN,
  CASHIER = RoleName.CASHIER,
}
