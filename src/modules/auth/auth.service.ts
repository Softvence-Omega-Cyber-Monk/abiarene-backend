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

  async pinLogin(dto: PinLoginDto) {
    const user = (await this.prisma.user.findFirst({
      where: { pin: dto.pin, status: 'ACTIVE' },
      include: { role: true },
    })) as any;

    if (!user || !user.role?.isActive) {
      throw new UnauthorizedException('Invalid PIN or disabled role');
    }

    const payload = {
      sub: user.id,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role.name,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }
}
