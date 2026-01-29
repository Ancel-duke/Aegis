import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ClassSerializerInterceptor,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../user/entities/user.entity';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

function requestContext(req: Request, userId: string) {
  return {
    actorId: userId,
    ipAddress: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RateLimit({ ttl: 60, limit: 30 })
  getSettings(@GetUser() user: User) {
    return this.settingsService.getSettings(user.id);
  }

  @Patch()
  @RateLimit({ ttl: 60, limit: 20 })
  @HttpCode(HttpStatus.OK)
  updateSettings(
    @GetUser() user: User,
    @Body() updateSettingsDto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    return this.settingsService.updateSettings(
      user.id,
      updateSettingsDto,
      requestContext(req, user.id),
    );
  }
}
