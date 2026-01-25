import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PolicyService } from './policy.service';
import { Policy, PolicyType, PolicyEffect } from './entities/policy.entity';
import { PolicyAuditLog, EvaluationResult } from './entities/policy-audit-log.entity';
import { Role, RoleType } from './entities/role.entity';
import { RedisService } from '../common/redis/redis.service';
import { EvaluatePolicyDto } from './dto/evaluate-policy.dto';

describe('PolicyService', () => {
  let service: PolicyService;
  let policyRepository: any;
  let auditLogRepository: any;

  const mockPolicyRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuditLogRepository = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockRoleRepository = {
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        {
          provide: getRepositoryToken(Policy),
          useValue: mockPolicyRepository,
        },
        {
          provide: getRepositoryToken(PolicyAuditLog),
          useValue: mockAuditLogRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
    policyRepository = module.get(getRepositoryToken(Policy));
    auditLogRepository = module.get(getRepositoryToken(PolicyAuditLog));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluate', () => {
    it('should allow access when matching ALLOW policy exists', async () => {
      const evaluateDto: EvaluatePolicyDto = {
        action: 'read',
        resource: '/api/users',
        type: PolicyType.API_ACCESS,
        context: {
          userId: 'user-123',
          role: 'user',
        },
      };

      const mockPolicy: Partial<Policy> = {
        id: 'policy-1',
        name: 'Allow User Read',
        type: PolicyType.API_ACCESS,
        effect: PolicyEffect.ALLOW,
        actions: ['read'],
        resources: ['/api/users'],
        conditions: { role: 'user' },
        priority: 100,
        isActive: true,
      };

      mockRedisService.get.mockResolvedValue(null);
      mockPolicyRepository.find.mockResolvedValue([mockPolicy]);
      mockAuditLogRepository.create.mockReturnValue({});
      mockAuditLogRepository.save.mockResolvedValue({});

      const result = await service.evaluate(evaluateDto);

      expect(result.allowed).toBe(true);
      expect(result.appliedPolicies).toContain('Allow User Read');
      expect(mockAuditLogRepository.save).toHaveBeenCalled();
    });

    it('should deny access when matching DENY policy exists', async () => {
      const evaluateDto: EvaluatePolicyDto = {
        action: 'delete',
        resource: '/api/users',
        type: PolicyType.API_ACCESS,
        context: {
          userId: 'user-123',
          role: 'user',
        },
      };

      const mockPolicy: Partial<Policy> = {
        id: 'policy-2',
        name: 'Deny User Delete',
        type: PolicyType.API_ACCESS,
        effect: PolicyEffect.DENY,
        actions: ['delete'],
        resources: ['/api/users'],
        conditions: { role: 'user' },
        priority: 200,
        isActive: true,
      };

      mockRedisService.get.mockResolvedValue(null);
      mockPolicyRepository.find.mockResolvedValue([mockPolicy]);
      mockAuditLogRepository.create.mockReturnValue({});
      mockAuditLogRepository.save.mockResolvedValue({});

      const result = await service.evaluate(evaluateDto);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Denied by policy');
    });

    it('should deny access when no matching policy exists', async () => {
      const evaluateDto: EvaluatePolicyDto = {
        action: 'unknown',
        resource: '/api/secret',
        type: PolicyType.API_ACCESS,
        context: {
          userId: 'user-123',
          role: 'user',
        },
      };

      mockRedisService.get.mockResolvedValue(null);
      mockPolicyRepository.find.mockResolvedValue([]);
      mockAuditLogRepository.create.mockReturnValue({});
      mockAuditLogRepository.save.mockResolvedValue({});

      const result = await service.evaluate(evaluateDto);

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('No matching policy found');
    });

    it('should prioritize DENY over ALLOW', async () => {
      const evaluateDto: EvaluatePolicyDto = {
        action: 'read',
        resource: '/api/users',
        type: PolicyType.API_ACCESS,
        context: {
          userId: 'user-123',
          role: 'user',
        },
      };

      const allowPolicy: Partial<Policy> = {
        id: 'policy-1',
        name: 'Allow User Read',
        type: PolicyType.API_ACCESS,
        effect: PolicyEffect.ALLOW,
        actions: ['read'],
        resources: ['/api/users'],
        conditions: { role: 'user' },
        priority: 100,
        isActive: true,
      };

      const denyPolicy: Partial<Policy> = {
        id: 'policy-2',
        name: 'Deny Specific User',
        type: PolicyType.API_ACCESS,
        effect: PolicyEffect.DENY,
        actions: ['*'],
        resources: ['/api/users'],
        conditions: { userId: 'user-123' },
        priority: 200,
        isActive: true,
      };

      mockRedisService.get.mockResolvedValue(null);
      mockPolicyRepository.find.mockResolvedValue([allowPolicy, denyPolicy]);
      mockAuditLogRepository.create.mockReturnValue({});
      mockAuditLogRepository.save.mockResolvedValue({});

      const result = await service.evaluate(evaluateDto);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Denied by policy');
    });

    it('should use cached decision when available', async () => {
      const evaluateDto: EvaluatePolicyDto = {
        action: 'read',
        resource: '/api/users',
        type: PolicyType.API_ACCESS,
        context: {
          userId: 'user-123',
          role: 'user',
        },
      };

      const cachedDecision = {
        allowed: true,
        reason: 'Cached decision',
        appliedPolicies: ['Policy 1'],
      };

      mockRedisService.get.mockResolvedValue(JSON.stringify(cachedDecision));

      const result = await service.evaluate(evaluateDto);

      expect(result).toEqual(cachedDecision);
      expect(mockPolicyRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('createPolicy', () => {
    it('should create a new policy', async () => {
      const createDto = {
        name: 'Test Policy',
        description: 'Test description',
        type: PolicyType.API_ACCESS,
        effect: PolicyEffect.ALLOW,
        conditions: { role: 'admin' },
        actions: ['read', 'write'],
        resources: ['/api/*'],
        priority: 100,
      };

      const mockPolicy = { id: 'policy-1', ...createDto };
      mockPolicyRepository.create.mockReturnValue(mockPolicy);
      mockPolicyRepository.save.mockResolvedValue(mockPolicy);

      const result = await service.createPolicy(createDto);

      expect(result).toEqual(mockPolicy);
      expect(mockPolicyRepository.save).toHaveBeenCalled();
    });
  });
});
