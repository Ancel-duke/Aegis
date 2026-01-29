import { IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class NotificationPreferences {
  email?: boolean;
  push?: boolean;
  websocket?: boolean;
  alertSeverities?: string[];
  alertFrequency?: 'realtime' | 'hourly' | 'daily';
}

export class UIPreferences {
  theme?: 'light' | 'dark' | 'system';
  dashboardLayout?: 'default' | 'compact' | 'detailed';
  itemsPerPage?: number;
}

export class AlertPreferences {
  defaultSeverityFilter?: string[];
  autoAcknowledge?: boolean;
  soundEnabled?: boolean;
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NotificationPreferences)
  notifications?: NotificationPreferences;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UIPreferences)
  ui?: UIPreferences;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AlertPreferences)
  alerts?: AlertPreferences;
}
