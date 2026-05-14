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

    // Handle user tokens
    if (!payload.tenantId) {
      throw new UnauthorizedException('Missing tenant ID in token');
    }

    const user = (await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        status: 'ACTIVE',
      },
      include: { role: true },
    })) as any;

    if (!user) {
      throw new UnauthorizedException('Invalid token subject');
    }

    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      sub: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role.name,
      tokenVersion: user.tokenVersion,
    };
  }
}
