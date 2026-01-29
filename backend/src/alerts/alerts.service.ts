import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { RedisService } from '../common/redis/redis.service';
import { AlertsGateway } from './alerts.gateway';

const METRICS_CACHE_KEY = 'metrics:current';
const METRICS_CACHE_TTL = 60;

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert)
    private alertRepository: Repository<Alert>,
    private redisService: RedisService,
    private alertsGateway: AlertsGateway,
  ) {}

  async findAll(filters?: { status?: string; severity?: string; limit?: number }): Promise<Alert[]> {
    const qb = this.alertRepository.createQueryBuilder('a');
    if (filters?.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters?.severity) qb.andWhere('a.severity = :severity', { severity: filters.severity });
    qb.orderBy('a.createdAt', 'DESC').limit(filters?.limit ?? 100);
    return await qb.getMany();
  }

  async findOne(id: string): Promise<Alert> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async create(dto: CreateAlertDto): Promise<Alert> {
    const alert = this.alertRepository.create({
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.alertRepository.save(alert);
    try {
      await this.redisService.del('alerts:current');
    } catch {
      // ignore
    }
    this.alertsGateway.broadcastAlert({
      id: saved.id,
      title: saved.title,
      severity: saved.severity,
      status: saved.status,
      createdAt: saved.createdAt,
    });
    return saved;
  }

  async update(id: string, dto: UpdateAlertDto): Promise<Alert> {
    const alert = await this.findOne(id);
    Object.assign(alert, dto);
    const updated = await this.alertRepository.save(alert);
    try {
      await this.redisService.del('alerts:current');
    } catch {
      // ignore
    }
    return updated;
  }

  async getCurrentMetrics(): Promise<Record<string, unknown>> {
    try {
      const cached = await this.redisService.get(METRICS_CACHE_KEY);
      if (cached) return JSON.parse(cached) as Record<string, unknown>;
    } catch {
      // ignore
    }
    const openAlerts = await this.alertRepository.count({ where: { status: 'open' } });
    const data = { openAlerts, timestamp: new Date().toISOString() };
    try {
      await this.redisService.set(METRICS_CACHE_KEY, JSON.stringify(data), METRICS_CACHE_TTL);
    } catch {
      // ignore
    }
    return data;
  }

  async getHistoricalMetrics(days: number = 7): Promise<unknown[]> {
    const start = new Date();
    start.setDate(start.getDate() - days);
    const qb = this.alertRepository
      .createQueryBuilder('a')
      .select('DATE(a.created_at)', 'date')
      .addSelect('a.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .where('a.createdAt >= :start', { start })
      .groupBy('DATE(a.created_at)')
      .addGroupBy('a.severity')
      .orderBy('date', 'DESC');
    return await qb.getRawMany();
  }
}
