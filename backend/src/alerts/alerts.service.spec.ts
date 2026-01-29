import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity';
import { AlertsService } from './alerts.service';
import { RedisService } from '../common/redis/redis.service';
import { AlertsGateway } from './alerts.gateway';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

describe('AlertsService', () => {
  let service: AlertsService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
    count: jest.fn().mockResolvedValue(0),
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  };

  const mockGateway = {
    broadcastAlert: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useValue: mockRepo },
        { provide: RedisService, useValue: mockRedis },
        { provide: AlertsGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    mockRepo.create.mockImplementation((x) => x);
    mockRepo.save.mockImplementation((x) => Promise.resolve({ ...x, id: 'alert-id' }));
    mockRepo.findOne.mockResolvedValue(null);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return list of alerts', async () => {
      mockRepo.createQueryBuilder = jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: '1', title: 'Test' }]),
        getRawMany: jest.fn().mockResolvedValue([]),
      }));
      const result = await service.findAll();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create alert and broadcast', async () => {
      const dto: CreateAlertDto = {
        title: 'Test Alert',
        severity: 'warning',
      };
      mockRepo.save.mockResolvedValue({
        id: 'new-id',
        title: dto.title,
        severity: dto.severity,
        status: 'open',
        createdAt: new Date(),
      });
      const result = await service.create(dto);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockGateway.broadcastAlert).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('update', () => {
    it('should throw NotFoundException when alert not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { status: 'resolved' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update alert', async () => {
      const existing = { id: '1', title: 'Old', status: 'open' };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockResolvedValue({ ...existing, status: 'resolved' });
      const dto: UpdateAlertDto = { status: 'resolved' };
      const result = await service.update('1', dto);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('resolved');
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return metrics with openAlerts and timestamp', async () => {
      mockRepo.count.mockResolvedValue(5);
      const result = await service.getCurrentMetrics();
      expect(result).toHaveProperty('openAlerts', 5);
      expect(result).toHaveProperty('timestamp');
    });
  });
});
