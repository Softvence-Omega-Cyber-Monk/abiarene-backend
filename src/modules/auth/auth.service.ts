import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PinLoginDto } from './auth.dto.js';

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

  async pinLogin(dto: PinLoginDto) {
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
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }
}
