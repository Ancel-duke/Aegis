import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { KubernetesService } from '../kubernetes/kubernetes.service';
import { AuditService } from '../audit/audit.service';
import { ActionType, ActionStatus } from '../audit/entities/action-audit-log.entity';
import { ExecuteActionDto } from './dto/execute-action.dto';

describe('ExecutorService', () => {
  let service: ExecutorService;
  let k8sService: KubernetesService;
  let auditService: AuditService;
  let configService: ConfigService;

  const mockKubernetesService = {
    resourceExists: jest.fn(),
    restartPod: jest.fn(),
    scaleDeployment: jest.fn(),
    rollbackDeployment: jest.fn(),
    getDeploymentStatus: jest.fn(),
  };

  const mockAuditService = {
    createAuditLog: jest.fn(),
    updateAuditLog: jest.fn(),
    markCompleted: jest.fn(),
    markFailed: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config = {
        ALLOWED_NAMESPACES: 'default,production',
        REQUIRE_ACTION_SIGNATURE: false,
        JWT_SECRET: 'test-secret',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutorService,
        {
          provide: KubernetesService,
          useValue: mockKubernetesService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ExecutorService>(ExecutorService);
    k8sService = module.get<KubernetesService>(KubernetesService);
    auditService = module.get<AuditService>(AuditService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeAction - Restart Pod', () => {
    it('should successfully restart a pod', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.RESTART_POD,
        actionParams: {
          namespace: 'default',
          podName: 'test-pod',
        },
        requestedBy: 'admin',
      };

      const mockAuditLog = { id: 'audit-123' };

      mockAuditService.createAuditLog.mockResolvedValue(mockAuditLog);
      mockAuditService.updateAuditLog.mockResolvedValue({});
      mockAuditService.markCompleted.mockResolvedValue({});
      mockKubernetesService.resourceExists.mockResolvedValue(true);
      mockKubernetesService.restartPod.mockResolvedValue({});

      const result = await service.executeAction(dto, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.auditId).toBe('audit-123');
      expect(mockKubernetesService.resourceExists).toHaveBeenCalledWith(
        'default',
        'pod',
        'test-pod',
      );
      expect(mockKubernetesService.restartPod).toHaveBeenCalledWith(
        'default',
        'test-pod',
      );
      expect(mockAuditService.markCompleted).toHaveBeenCalled();
    });

    it('should fail if pod does not exist', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.RESTART_POD,
        actionParams: {
          namespace: 'default',
          podName: 'nonexistent-pod',
        },
        requestedBy: 'admin',
      };

      mockAuditService.createAuditLog.mockResolvedValue({ id: 'audit-123' });
      mockAuditService.updateAuditLog.mockResolvedValue({});
      mockAuditService.markFailed.mockResolvedValue({});
      mockKubernetesService.resourceExists.mockResolvedValue(false);

      const result = await service.executeAction(dto, '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(mockAuditService.markFailed).toHaveBeenCalled();
    });

    it('should reject action in non-allowed namespace', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.RESTART_POD,
        actionParams: {
          namespace: 'forbidden-namespace',
          podName: 'test-pod',
        },
        requestedBy: 'admin',
      };

      await expect(service.executeAction(dto, '127.0.0.1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('executeAction - Scale Deployment', () => {
    it('should successfully scale a deployment', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.SCALE_DEPLOYMENT,
        actionParams: {
          namespace: 'default',
          deploymentName: 'test-deployment',
          replicas: 5,
        },
        requestedBy: 'admin',
      };

      mockAuditService.createAuditLog.mockResolvedValue({ id: 'audit-456' });
      mockAuditService.updateAuditLog.mockResolvedValue({});
      mockAuditService.markCompleted.mockResolvedValue({});
      mockKubernetesService.resourceExists.mockResolvedValue(true);
      mockKubernetesService.getDeploymentStatus.mockResolvedValue({
        spec: { replicas: 3 },
      });
      mockKubernetesService.scaleDeployment.mockResolvedValue({});

      const result = await service.executeAction(dto, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(result.auditId).toBe('audit-456');
      expect(mockKubernetesService.scaleDeployment).toHaveBeenCalledWith(
        'default',
        'test-deployment',
        5,
      );
      expect(result.result.previousReplicas).toBe(3);
      expect(result.result.newReplicas).toBe(5);
    });

    it('should fail if deployment does not exist', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.SCALE_DEPLOYMENT,
        actionParams: {
          namespace: 'default',
          deploymentName: 'nonexistent-deployment',
          replicas: 5,
        },
        requestedBy: 'admin',
      };

      mockAuditService.createAuditLog.mockResolvedValue({ id: 'audit-456' });
      mockAuditService.updateAuditLog.mockResolvedValue({});
      mockAuditService.markFailed.mockResolvedValue({});
      mockKubernetesService.resourceExists.mockResolvedValue(false);

      const result = await service.executeAction(dto, '127.0.0.1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('executeAction - Rollback Deployment', () => {
    it('should successfully rollback a deployment', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.ROLLBACK_DEPLOYMENT,
        actionParams: {
          namespace: 'production',
          deploymentName: 'api-deployment',
          revision: 2,
        },
        requestedBy: 'admin',
      };

      mockAuditService.createAuditLog.mockResolvedValue({ id: 'audit-789' });
      mockAuditService.updateAuditLog.mockResolvedValue({});
      mockAuditService.markCompleted.mockResolvedValue({});
      mockKubernetesService.resourceExists.mockResolvedValue(true);
      mockKubernetesService.rollbackDeployment.mockResolvedValue({});

      const result = await service.executeAction(dto, '127.0.0.1');

      expect(result.success).toBe(true);
      expect(mockKubernetesService.rollbackDeployment).toHaveBeenCalledWith(
        'production',
        'api-deployment',
        2,
      );
    });
  });

  describe('signature validation', () => {
    it('should generate and validate correct signature', () => {
      const actionType = ActionType.RESTART_POD;
      const actionParams = { namespace: 'default', podName: 'test-pod' };
      const requestedBy = 'admin';

      const signature = service.generateSignature(
        actionType,
        actionParams,
        requestedBy,
      );

      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(0);
    });
  });

  describe('namespace validation', () => {
    it('should allow actions in allowed namespaces', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.RESTART_POD,
        actionParams: {
          namespace: 'default', // allowed
          podName: 'test-pod',
        },
        requestedBy: 'admin',
      };

      mockAuditService.createAuditLog.mockResolvedValue({ id: 'audit-123' });
      mockAuditService.updateAuditLog.mockResolvedValue({});
      mockAuditService.markCompleted.mockResolvedValue({});
      mockKubernetesService.resourceExists.mockResolvedValue(true);
      mockKubernetesService.restartPod.mockResolvedValue({});

      const result = await service.executeAction(dto, '127.0.0.1');

      expect(result.success).toBe(true);
    });

    it('should reject actions in non-allowed namespaces', async () => {
      const dto: ExecuteActionDto = {
        actionType: ActionType.RESTART_POD,
        actionParams: {
          namespace: 'kube-system', // not allowed
          podName: 'test-pod',
        },
        requestedBy: 'admin',
      };

      await expect(service.executeAction(dto, '127.0.0.1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
