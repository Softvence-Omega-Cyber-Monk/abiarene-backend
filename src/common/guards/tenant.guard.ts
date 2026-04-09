import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContextService } from '../context/tenant-context.service.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser; headers: Record<string, string> }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user context');
    }
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant not found in token');
    }

    this.tenantContext.setTenant(user.tenantId);
    return true;
  }
}
