import { IsString, IsObject, IsOptional, IsNotEmpty, MinLength } from 'class-validator';

export class ExecutorActionDto {
  @IsString()
  @IsNotEmpty()
  actionType: string;

  @IsString()
  @IsNotEmpty()
  namespace: string;

  @IsString()
  @IsNotEmpty()
  resourceType: string;

  @IsString()
  @IsNotEmpty()
  resourceName: string;

  @IsObject()
  @IsOptional()
  actionParams?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  requestedBy?: string;

  @IsString()
  @MinLength(1, { message: 'Signature is required for action verification' })
  signature: string;

  @IsString()
  @IsNotEmpty({ message: 'Timestamp is required for signature verification' })
  timestamp: string;
}
