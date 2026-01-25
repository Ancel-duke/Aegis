import {
  IsString,
  IsObject,
  IsOptional,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyType } from '../entities/policy.entity';

export class PolicyContextDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class EvaluatePolicyDto {
  @IsString()
  action: string;

  @IsString()
  resource: string;

  @IsEnum(PolicyType)
  type: PolicyType;

  @ValidateNested()
  @Type(() => PolicyContextDto)
  context: PolicyContextDto;
}
