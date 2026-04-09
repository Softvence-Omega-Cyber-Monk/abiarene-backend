import { IsOptional, IsString } from 'class-validator';

export class CreateAdminDto {}
export class UpdateAdminDto {}
export class ListAdminDto { @IsOptional() @IsString() from?: string; @IsOptional() @IsString() to?: string; }
