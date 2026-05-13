import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  Length,
  Matches,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { StaffRoleName } from '../../common/constants/role-name.js';

export class CreateUsersDto {
  @ApiProperty({ description: 'User full name', minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({ description: 'User email', example: 'server@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: '4-digit PIN',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    example: '1234',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;

  @ApiProperty({
    description: 'Role',
    enum: StaffRoleName,
    enumName: 'StaffRoleName',
    example: StaffRoleName.SERVER,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(StaffRoleName)
  role!: StaffRoleName;
}

export class UpdateUsersDto extends PartialType(CreateUsersDto) {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ description: 'User full name', minLength: 2, maxLength: 80 })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  name?: string;

  @ApiPropertyOptional({ description: 'User email', example: 'manager@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: '4-digit PIN',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;
}

export class ListUsersDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional({ description: 'Search by user name' })
  @IsOptional()
  @IsString()
  search?: string;
}
