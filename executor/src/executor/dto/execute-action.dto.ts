import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActionType } from '../../audit/entities/action-audit-log.entity';

export class PolicyDecisionDto {
  @IsString()
  allowed: boolean;

  @IsString()
  reason: string;

  @IsString({ each: true })
  appliedPolicies: string[];
}

export class RestartPodParamsDto {
  @IsString()
  namespace: string;

  @IsString()
  podName: string;
}

export class ScaleDeploymentParamsDto {
  @IsString()
  namespace: string;

  @IsString()
  deploymentName: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  replicas: number;
}

export class RollbackDeploymentParamsDto {
  @IsString()
  namespace: string;

  @IsString()
  deploymentName: string;

  @IsNumber()
  @IsOptional()
  revision?: number;
}

export class ExecuteActionDto {
  @IsEnum(ActionType)
  actionType: ActionType;

  @IsObject()
  actionParams:
    | RestartPodParamsDto
    | ScaleDeploymentParamsDto
    | RollbackDeploymentParamsDto;

  @IsString()
  @IsOptional()
  requestedBy?: string;

  @ValidateNested()
  @Type(() => PolicyDecisionDto)
  @IsOptional()
  policyDecision?: PolicyDecisionDto;

  @IsString()
  @IsOptional()
  signature?: string;
}
