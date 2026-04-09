import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { PinLoginDto } from './auth.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('pin-login')
  @Public()
  @ApiOperation({ summary: 'Authenticate user by PIN' })
  @ApiResponse({ status: 201, description: 'PIN authentication successful' })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  pinLogin(@Body() dto: PinLoginDto) {
    return this.authService.pinLogin(dto);
  }
}
