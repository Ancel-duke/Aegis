import {
  IsString,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { PolicyType, PolicyEffect } from '../entities/policy.entity';

export class CreatePolicyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PolicyType)
  type: PolicyType;

  @IsEnum(PolicyEffect)
  effect: PolicyEffect;

  @IsObject()
  conditions: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  actions: string[];

  @IsArray()
  @IsString({ each: true })
  resources: string[];

  @IsNumber()
  @Min(0)
  @Max(1000)
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
