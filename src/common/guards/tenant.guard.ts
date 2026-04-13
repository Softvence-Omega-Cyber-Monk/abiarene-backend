import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { TenantContextService } from '../context/tenant-context.service.js';
import { AuthUser } from '../interfaces/auth-user.interface.js';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: any; headers: Record<string, string> }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Missing authenticated user context');
    }
    
    // Skip tenantId validation for admin tokens
    if (user.role === 'admin') {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant not found in token');
    }

    this.tenantContext.setTenant(user.tenantId);
    return true;
  }
}
