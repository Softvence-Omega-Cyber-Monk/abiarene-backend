import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateMenuDto {
  @ApiProperty({ description: 'Menu name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Whether the menu is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}

export class ListMenuDto extends PaginationDto {}
