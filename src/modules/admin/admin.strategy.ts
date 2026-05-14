import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleName } from '../../common/constants/role-name.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AdminStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
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
    email: string;
    role: string;
    tokenVersion?: number;
  }) {
    if (payload.role?.toUpperCase() !== RoleName.ADMIN) {
      throw new UnauthorizedException('Not an admin token');
    }

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
}
