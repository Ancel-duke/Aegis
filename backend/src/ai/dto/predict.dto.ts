import {
  IsString,
  IsArray,
  IsObject,
  IsOptional,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MetricDataDto {
  @IsString()
  metric_type: string;

  @IsOptional()
  value: number;

  @IsOptional()
  timestamp: string;

  @IsObject()
  @IsOptional()
  labels?: Record<string, string>;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class LogDataDto {
  @IsOptional()
  timestamp: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  service?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export enum PredictType {
  ANOMALY = 'anomaly',
  FAILURE = 'failure',
}

export class PredictDto {
  @IsEnum(PredictType)
  type: PredictType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MetricDataDto)
  metrics: MetricDataDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LogDataDto)
  @IsOptional()
  logs?: LogDataDto[];

  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}
