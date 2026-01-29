import { IsString, IsOptional, IsObject, IsIn, MaxLength } from 'class-validator';

export class UpdateAlertDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['info', 'warning', 'error', 'critical'])
  severity?: string;

  @IsString()
  @IsOptional()
  @IsIn(['open', 'acknowledged', 'resolved'])
  status?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
