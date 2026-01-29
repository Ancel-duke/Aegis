import { IsString, MaxLength, IsOptional, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  avatar?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
