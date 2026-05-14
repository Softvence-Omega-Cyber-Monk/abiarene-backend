import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RoleName } from '../../common/constants/role-name.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LoginDto } from './auth.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getTenants() {
    return this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTenantUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        role: { is: { isActive: true } },
      },
      include: {
        role: { select: { id: true, name: true, isActive: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async login(dto: LoginDto) {
    const admin = await this.prisma.admin.findFirst({
      where: { email: dto.email, pin: dto.pin, status: 'ACTIVE' },
    });

    if (admin) {
      const payload = {
        sub: admin.id,
        email: admin.email,
        role: RoleName.ADMIN,
        tokenVersion: admin.tokenVersion,
      };

      return {
        accessToken: await this.jwtService.signAsync(payload),
        user: payload,
      };
    }

    const user = (await this.prisma.user.findFirst({
      where: { pin: dto.pin, email: dto.email, status: 'ACTIVE' },
      include: { role: true },
    })) as any;

    if (!user || !user.role?.isActive) {
      throw new UnauthorizedException('Invalid email/PIN or disabled role');
    }

    const payload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role.name,
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }

  async logout(user: {
    sub: string;
    role: string;
    tenantId?: string;
  }) {
    if (user.role?.toUpperCase() === RoleName.ADMIN) {
      await this.prisma.admin.update({
        where: { id: user.sub },
        data: { tokenVersion: { increment: 1 } },
      });

      return { message: 'Logged out successfully' };
    }

    await this.prisma.user.update({
      where: { id: user.sub },
      data: { tokenVersion: { increment: 1 } },
    });

    return { message: 'Logged out successfully' };
  }
}
