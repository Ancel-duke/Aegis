import { IsString, IsOptional, IsObject, IsIn, MaxLength } from 'class-validator';

export class CreateAlertDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['info', 'warning', 'error', 'critical'])
  severity: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
