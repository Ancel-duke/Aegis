import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosInstance } from 'axios';
import { PredictionResult } from './entities/prediction-result.entity';
import { PredictDto, PredictType } from './dto/predict.dto';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(
    private configService: ConfigService,
    @InjectRepository(PredictionResult)
    private predictionRepository: Repository<PredictionResult>,
  ) {
    this.baseUrl =
      this.configService.get<string>('AI_ENGINE_URL', 'http://localhost:8000') +
      '/api/v1';
    this.apiKey = this.configService.get<string>('AI_ENGINE_API_KEY');
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: this.apiKey
        ? { 'X-API-Key': this.apiKey, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' },
    });
  }

  async predict(dto: PredictDto): Promise<Record<string, unknown>> {
    const start = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.callAiEngine(dto);
        const duration = Date.now() - start;
        await this.storePrediction(dto, response, true, null, duration);
        this.logger.log(
          `Prediction ${dto.type} completed in ${duration}ms (attempt ${attempt})`,
        );
        return response as Record<string, unknown>;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(
          `AI Engine attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`,
        );
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    await this.storePrediction(
      dto,
      {},
      false,
      lastError?.message ?? 'Unknown error',
      null,
    );
    throw new BadGatewayException(
      `AI Engine unavailable after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  }

  private async callAiEngine(dto: PredictDto): Promise<unknown> {
    if (dto.type === PredictType.FAILURE && dto.logs?.length) {
      const res = await this.client.post('/detect-failure', {
        metrics: dto.metrics,
        logs: dto.logs,
        context: dto.context ?? {},
      });
      return res.data;
    }
    const res = await this.client.post('/detect-anomaly', {
      metrics: dto.metrics,
      context: dto.context ?? {},
    });
    return res.data;
  }

  private async storePrediction(
    dto: PredictDto,
    response: Record<string, unknown>,
    success: boolean,
    errorMessage: string | null,
    _durationMs: number | null,
  ): Promise<void> {
    try {
      const entity = this.predictionRepository.create({
        predictionType: dto.type,
        requestPayload: {
          type: dto.type,
          metricsCount: dto.metrics?.length ?? 0,
          logsCount: dto.logs?.length ?? 0,
        },
        responsePayload: response,
        score:
          typeof (response as any).anomaly_score === 'number'
            ? (response as any).anomaly_score
            : typeof (response as any).confidence === 'number'
              ? (response as any).confidence
              : null,
        severity: (response as any).severity ?? null,
        success,
        errorMessage,
      });
      await this.predictionRepository.save(entity);
    } catch (err) {
      this.logger.error(`Failed to store prediction: ${(err as Error).message}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  async getMetrics(): Promise<{
    totalPredictions: number;
    byType: Record<string, number>;
    successRate: number;
    last24h: number;
  }> {
    const all = await this.predictionRepository.find();
    const byType: Record<string, number> = {};
    let successCount = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let last24h = 0;

    for (const p of all) {
      byType[p.predictionType] = (byType[p.predictionType] ?? 0) + 1;
      if (p.success) successCount++;
      if (p.createdAt >= oneDayAgo) last24h++;
    }

    return {
      totalPredictions: all.length,
      byType,
      successRate: all.length ? successCount / all.length : 0,
      last24h,
    };
  }
}
