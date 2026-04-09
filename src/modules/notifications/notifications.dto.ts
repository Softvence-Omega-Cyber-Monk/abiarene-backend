import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateNotificationsDto {
  @ApiProperty({ description: 'Notification title' })
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Notification message' })
  @IsString()
  message!: string;
}

export class UpdateNotificationsDto extends PartialType(CreateNotificationsDto) {}

export class ListNotificationsDto extends PaginationDto {}
