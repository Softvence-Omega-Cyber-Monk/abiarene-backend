import { IsString, Length, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PinLoginDto {
  @ApiProperty({ description: '4-digit user PIN', minLength: 4, maxLength: 4, example: '1234' })
  @IsString()
  @Length(4, 4)
  pin!: string;

  @ApiProperty({ description: 'Tenant ID', example: 'tenant-demo-1' })
  @IsString()
  tenantId!: string;
}

export class TenantResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class UserResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: { id: string; name: string; isActive: boolean };

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
