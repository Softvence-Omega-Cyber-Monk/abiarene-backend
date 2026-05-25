import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleName } from '../../common/constants/role-name.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    tenantId?: string;
    role: string;
    name?: string;
    email?: string;
    tokenVersion?: number;
  }) {
    // Handle admin tokens
    if (payload.role?.toUpperCase() === RoleName.ADMIN) {
      const admin = await this.prisma.admin.findFirst({
        where: { id: payload.sub, status: 'ACTIVE' },
      });

      if (!admin) {
        throw new UnauthorizedException('Admin not found or inactive');
      }

      if ((payload.tokenVersion ?? 0) !== admin.tokenVersion) {
        throw new UnauthorizedException('Token has been revoked');
      }

      return {
        sub: admin.id,
        email: admin.email,
        role: RoleName.ADMIN,
        tokenVersion: admin.tokenVersion,
      };
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        status: 'ACTIVE',
      },
      include: { role: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid token subject');
    }

    if (payload.tenantId && user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Invalid tenant scope in token');
    }

    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const role = user.role?.isActive ? user.role.name : user.pendingRole;
    if (!role) {
      throw new UnauthorizedException('User role not found or inactive');
    }

    if (payload.role?.toUpperCase() !== role) {
      throw new UnauthorizedException('Invalid role in token');
    }

    return {
      sub: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId ?? undefined,
      role,
      tokenVersion: user.tokenVersion,
    };
  }
}
