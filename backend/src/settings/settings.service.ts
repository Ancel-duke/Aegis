import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/entities/audit-event.entity';

export interface SettingsChangeContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private auditService: AuditService,
  ) {}

  async getSettings(userId: string): Promise<Record<string, unknown>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Return default settings merged with user preferences
    return {
      notifications: {
        email: true,
        push: true,
        websocket: true,
        alertSeverities: ['critical', 'high'],
        alertFrequency: 'realtime',
        ...(user.preferences?.notifications || {}),
      },
      ui: {
        theme: 'system',
        dashboardLayout: 'default',
        itemsPerPage: 20,
        ...(user.preferences?.ui || {}),
      },
      alerts: {
        defaultSeverityFilter: [],
        autoAcknowledge: false,
        soundEnabled: true,
        ...(user.preferences?.alerts || {}),
      },
    };
  }

  async updateSettings(
    userId: string,
    updateSettingsDto: UpdateSettingsDto,
    ctx?: SettingsChangeContext,
  ): Promise<Record<string, unknown>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Merge new preferences with existing ones
    const currentPreferences = user.preferences || {};
    const updatedPreferences = {
      ...currentPreferences,
      ...(updateSettingsDto.notifications && {
        notifications: {
          ...(currentPreferences.notifications || {}),
          ...updateSettingsDto.notifications,
        },
      }),
      ...(updateSettingsDto.ui && {
        ui: {
          ...(currentPreferences.ui || {}),
          ...updateSettingsDto.ui,
        },
      }),
      ...(updateSettingsDto.alerts && {
        alerts: {
          ...(currentPreferences.alerts || {}),
          ...updateSettingsDto.alerts,
        },
      }),
    };

    user.preferences = updatedPreferences;
    const savedUser = await this.userRepository.save(user);

    await this.auditService.logUserChange({
      eventType: AuditEventType.USER_UPDATE,
      userId: ctx?.actorId ?? savedUser.id,
      entityId: savedUser.id,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      details: { preferences: updatedPreferences },
    });

    this.logger.log(`Settings updated for user id=${savedUser.id}`);

    // Return merged settings with defaults
    return this.getSettings(savedUser.id);
  }
}
