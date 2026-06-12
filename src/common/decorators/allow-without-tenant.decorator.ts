import { SetMetadata } from '@nestjs/common';

export const ALLOW_WITHOUT_TENANT_KEY = 'allowWithoutTenant';
export const AllowWithoutTenant = () =>
  SetMetadata(ALLOW_WITHOUT_TENANT_KEY, true);
