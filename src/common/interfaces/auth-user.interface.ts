export interface AuthUser {
  sub: string;
  name?: string;
  email?: string;
  tenantId: string;
  role: string;
}
