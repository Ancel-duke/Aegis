import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiService } from './ai.service';
import { PredictionResult } from './entities/prediction-result.entity';
import { PredictDto, PredictType } from './dto/predict.dto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AiService', () => {
  let service: AiService;
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockedAxios.create = jest.fn().mockReturnValue({
      post: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: getRepositoryToken(PredictionResult),
          useValue: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'AI_ENGINE_URL') return 'http://localhost:8000';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    (service as any).client = {
      post: jest.fn(),
    };
    mockRepo.create.mockImplementation((x) => x);
    mockRepo.save.mockResolvedValue(undefined);
    mockRepo.find.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('predict', () => {
    const dto: PredictDto = {
      type: PredictType.ANOMALY,
      metrics: [
        {
          metric_type: 'cpu_usage',
          value: 0.9,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    it('should return AI response and store prediction', async () => {
      const mockResponse = {
        is_anomaly: true,
        anomaly_score: 0.85,
        severity: 'high',
        recommended_action: 'scale_up',
        confidence: 0.9,
        affected_metrics: ['cpu_usage'],
        details: {},
      };
      (service as any).client.post.mockResolvedValue({ data: mockResponse });

      const result = await service.predict(dto);

      expect(result).toEqual(mockResponse);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should retry on failure and throw after max retries', async () => {
      (service as any).client.post.mockRejectedValue(new Error('Connection refused'));

      await expect(service.predict(dto)).rejects.toThrow(BadGatewayException);
      expect((service as any).client.post).toHaveBeenCalledTimes(3);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorMessage: expect.any(String),
        }),
      );
    });
  });

  describe('getMetrics', () => {
    it('should return prediction statistics', async () => {
      mockRepo.find.mockResolvedValue([
        { predictionType: 'anomaly', success: true, createdAt: new Date() },
        { predictionType: 'anomaly', success: false, createdAt: new Date() },
      ]);

      const result = await service.getMetrics();

      expect(result.totalPredictions).toBe(2);
      expect(result.byType.anomaly).toBe(2);
      expect(result.successRate).toBe(0.5);
    });
  });
});
