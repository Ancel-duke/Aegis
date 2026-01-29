import { Controller, Get, Post, Patch, Body, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @Public()
  async findAll(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: number,
  ) {
    return await this.alertsService.findAll({ status, severity, limit: limit ? Number(limit) : undefined });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateAlertDto) {
    return await this.alertsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAlertDto) {
    return await this.alertsService.update(id, dto);
  }
}
