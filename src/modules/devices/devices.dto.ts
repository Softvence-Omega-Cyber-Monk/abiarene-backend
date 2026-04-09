import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateDevicesDto {
  @ApiProperty({ description: 'Device name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Whether the device is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDevicesDto extends PartialType(CreateDevicesDto) {}

export class ListDevicesDto extends PaginationDto {}
