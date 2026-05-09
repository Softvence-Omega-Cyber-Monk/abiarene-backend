export enum RoleName {
  MANAGER = 'MANAGER',
  SERVER = 'SERVER',
  KITCHEN = 'KITCHEN',
  CASHIER = 'CASHIER',
  ADMIN = 'ADMIN',
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
