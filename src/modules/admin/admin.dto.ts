import {
  IsEmail,
  IsOptional,
  Matches,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminSignupDto {
  @ApiProperty({ description: 'Admin email', example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Admin 4-digit PIN',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    example: '1234',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;

  @ApiProperty({ description: 'Admin name', example: 'John Admin' })
  @IsString()
  name!: string;
}

export class AdminResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class CreateAdminDto {}
export class UpdateAdminDto {}
export class ListAdminDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}
