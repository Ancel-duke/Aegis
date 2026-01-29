import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ExecutorService } from './executor.service';
import { ActionAuditLog } from './entities/action-audit-log.entity';
import { ExecutorActionDto } from './dto/executor-action.dto';

describe('ExecutorService', () => {
  let service: ExecutorService;
  const secret = 'test-hmac-secret';
  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  function buildDto(overrides: Partial<ExecutorActionDto> = {}): ExecutorActionDto {
    const timestamp = String(Date.now());
    const payload = [
      'restart_pod',
      'default',
      'pod',
      'my-pod',
      timestamp,
    ].join('|');
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    return {
      actionType: 'restart_pod',
      namespace: 'default',
      resourceType: 'pod',
      resourceName: 'my-pod',
      timestamp,
      signature,
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutorService,
        {
          provide: getRepositoryToken(ActionAuditLog),
          useValue: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: string) => {
              if (key === 'EXECUTOR_HMAC_SECRET') return secret;
              if (key === 'EXECUTOR_NAMESPACE_ALLOWLIST') return 'default,aegis';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ExecutorService>(ExecutorService);
    mockRepo.create.mockImplementation((x) => ({ id: 'log-id', ...x }));
    mockRepo.save.mockResolvedValue({ id: 'log-id', status: 'in_progress' });
    mockRepo.update.mockResolvedValue(undefined);
    mockRepo.find.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySignature', () => {
    it('should return true for valid signature', () => {
      const dto = buildDto();
      expect(service.verifySignature(dto)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const dto = buildDto({ signature: 'invalid' });
      expect(service.verifySignature(dto)).toBe(false);
    });

    it('should return false when payload is tampered', () => {
      const dto = buildDto({ namespace: 'other' });
      expect(service.verifySignature(dto)).toBe(false);
    });
  });

  describe('isNamespaceAllowed', () => {
    it('should allow namespaces in allowlist', () => {
      expect(service.isNamespaceAllowed('default')).toBe(true);
      expect(service.isNamespaceAllowed('aegis')).toBe(true);
    });

    it('should deny namespaces not in allowlist', () => {
      expect(service.isNamespaceAllowed('forbidden')).toBe(false);
    });
  });

  describe('executeAction', () => {
    it('should reject invalid signature', async () => {
      const dto = buildDto({ signature: 'wrong' });
      await expect(service.executeAction(dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should reject namespace not in allowlist', async () => {
      const dto = buildDto({ namespace: 'forbidden' });
      dto.signature = createHmac('sha256', secret)
        .update([dto.actionType, dto.namespace, dto.resourceType, dto.resourceName, dto.timestamp].join('|'))
        .digest('hex');
      await expect(service.executeAction(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log and execute when valid', async () => {
      const dto = buildDto();
      const result = await service.executeAction(dto);
      expect(result).toHaveProperty('id', 'log-id');
      expect(result.status).toBe('completed');
      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalled();
    });
  });

  describe('runSelfHealing', () => {
    it('should return counts of restarted and retried', async () => {
      mockRepo.find.mockResolvedValue([
        { actionType: 'restart_pod' },
        { actionType: 'rollback_deployment' },
      ]);
      const result = await service.runSelfHealing();
      expect(result.restarted).toBe(1);
      expect(result.retried).toBe(1);
    });
  });

  describe('getHealth', () => {
    it('should return status ok', async () => {
      const result = await service.getHealth();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });
});
