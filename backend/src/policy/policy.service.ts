import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Policy, PolicyEffect, PolicyType } from './entities/policy.entity';
import { PolicyAuditLog, EvaluationResult } from './entities/policy-audit-log.entity';
import { Role } from './entities/role.entity';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { EvaluatePolicyDto } from './dto/evaluate-policy.dto';
import { RedisService } from '../common/redis/redis.service';

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  appliedPolicies: string[];
  context?: Record<string, any>;
}

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    @InjectRepository(Policy)
    private policyRepository: Repository<Policy>,
    @InjectRepository(PolicyAuditLog)
    private auditLogRepository: Repository<PolicyAuditLog>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private redisService: RedisService,
  ) {}

  /**
   * Evaluate a policy request
   */
  async evaluate(dto: EvaluatePolicyDto): Promise<PolicyDecision> {
    const { action, resource, type, context } = dto;

    // Check cache first
    const cacheKey = this.buildCacheKey(dto);
    const cached = await this.getCachedDecision(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for policy decision: ${cacheKey}`);
      return cached;
    }

    try {
      // Fetch applicable policies
      const policies = await this.getApplicablePolicies(type, action, resource);

      // Sort by priority (higher priority first)
      policies.sort((a, b) => b.priority - a.priority);

      let decision: PolicyDecision = {
        allowed: false,
        reason: 'No matching policy found',
        appliedPolicies: [],
      };

      // Evaluate policies in order
      for (const policy of policies) {
        const matches = await this.evaluateConditions(policy.conditions, context);

        if (matches) {
          decision = {
            allowed: policy.effect === PolicyEffect.ALLOW,
            reason: policy.effect === PolicyEffect.ALLOW
              ? `Allowed by policy: ${policy.name}`
              : `Denied by policy: ${policy.name}`,
            appliedPolicies: [...decision.appliedPolicies, policy.name],
          };

          // If it's a DENY, stop immediately (deny takes precedence)
          if (policy.effect === PolicyEffect.DENY) {
            break;
          }
        }
      }

      // Log the evaluation
      await this.logEvaluation({
        userId: context.userId || null,
        action,
        resource,
        result: decision.allowed ? EvaluationResult.ALLOW : EvaluationResult.DENY,
        context: context.metadata || {},
        appliedPolicies: decision.appliedPolicies,
        reason: decision.reason,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      // Cache the decision
      await this.cacheDecision(cacheKey, decision);

      return decision;
    } catch (error) {
      this.logger.error(`Policy evaluation error: ${error.message}`, error.stack);

      // Log error in audit
      await this.logEvaluation({
        userId: context.userId || null,
        action,
        resource,
        result: EvaluationResult.ERROR,
        context: context.metadata || {},
        appliedPolicies: [],
        reason: `Evaluation error: ${error.message}`,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      return {
        allowed: false,
        reason: 'Policy evaluation error',
        appliedPolicies: [],
      };
    }
  }

  /**
   * Evaluate policy conditions against context
   */
  private async evaluateConditions(
    conditions: Record<string, any>,
    context: any,
  ): Promise<boolean> {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'role':
          if (context.role !== value) return false;
          break;

        case 'roles':
          if (!Array.isArray(value) || !value.includes(context.role)) return false;
          break;

        case 'userId':
          if (context.userId !== value) return false;
          break;

        case 'ipRange':
          // Simple IP range check (can be enhanced)
          if (!this.isIpInRange(context.ipAddress, value)) return false;
          break;

        case 'timeRange':
          if (!this.isWithinTimeRange(value)) return false;
          break;

        case 'metadata':
          if (!this.matchMetadata(value, context.metadata)) return false;
          break;

        default:
          // Custom condition evaluation
          if (context[key] !== value) return false;
      }
    }

    return true;
  }

  /**
   * Get applicable policies for a request
   */
  private async getApplicablePolicies(
    type: PolicyType,
    action: string,
    resource: string,
  ): Promise<Policy[]> {
    const policies = await this.policyRepository.find({
      where: { type, isActive: true },
    });

    return policies.filter((policy) => {
      const actionMatch =
        policy.actions.includes('*') ||
        policy.actions.includes(action) ||
        policy.actions.some((a) => this.wildcardMatch(action, a));

      const resourceMatch =
        policy.resources.includes('*') ||
        policy.resources.includes(resource) ||
        policy.resources.some((r) => this.wildcardMatch(resource, r));

      return actionMatch && resourceMatch;
    });
  }

  /**
   * Wildcard matching for actions/resources
   */
  private wildcardMatch(str: string, pattern: string): boolean {
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    return regex.test(str);
  }

  /**
   * Check if IP is in range (simple implementation)
   */
  private isIpInRange(ip: string, range: string): boolean {
    // Simplified - in production use a proper IP range library
    return true;
  }

  /**
   * Check if current time is within allowed range
   */
  private isWithinTimeRange(range: { start: string; end: string }): boolean {
    const now = new Date();
    const start = new Date(range.start);
    const end = new Date(range.end);
    return now >= start && now <= end;
  }

  /**
   * Match metadata conditions
   */
  private matchMetadata(
    expected: Record<string, any>,
    actual: Record<string, any>,
  ): boolean {
    for (const [key, value] of Object.entries(expected)) {
      if (actual[key] !== value) return false;
    }
    return true;
  }

  /**
   * Log policy evaluation to audit log (immutable)
   */
  private async logEvaluation(data: Partial<PolicyAuditLog>): Promise<void> {
    try {
      const log = this.auditLogRepository.create(data);
      await this.auditLogRepository.save(log);
    } catch (error) {
      this.logger.error(`Failed to log policy evaluation: ${error.message}`);
    }
  }

  /**
   * Build cache key for policy decision
   */
  private buildCacheKey(dto: EvaluatePolicyDto): string {
    return `policy:${dto.type}:${dto.action}:${dto.resource}:${dto.context.userId || 'anonymous'}:${dto.context.role || 'none'}`;
  }

  /**
   * Get cached decision
   */
  private async getCachedDecision(key: string): Promise<PolicyDecision | null> {
    try {
      const cached = await this.redisService.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache decision
   */
  private async cacheDecision(key: string, decision: PolicyDecision): Promise<void> {
    try {
      await this.redisService.set(key, JSON.stringify(decision), 300); // 5 min cache
    } catch (error) {
      this.logger.warn(`Failed to cache decision: ${error.message}`);
    }
  }

  /**
   * CRUD Operations for Policies
   */

  async createPolicy(createPolicyDto: CreatePolicyDto): Promise<Policy> {
    const policy = this.policyRepository.create(createPolicyDto);
    const saved = await this.policyRepository.save(policy);
    this.logger.log(`Policy created: ${saved.name} (${saved.id})`);
    return saved;
  }

  async findAllPolicies(): Promise<Policy[]> {
    return await this.policyRepository.find();
  }

  async findPolicyById(id: string): Promise<Policy> {
    const policy = await this.policyRepository.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
    return policy;
  }

  async updatePolicy(id: string, updatePolicyDto: UpdatePolicyDto): Promise<Policy> {
    const policy = await this.findPolicyById(id);
    Object.assign(policy, updatePolicyDto);
    const updated = await this.policyRepository.save(policy);
    this.logger.log(`Policy updated: ${updated.name} (${updated.id})`);
    return updated;
  }

  async deletePolicy(id: string): Promise<void> {
    const policy = await this.findPolicyById(id);
    await this.policyRepository.remove(policy);
    this.logger.log(`Policy deleted: ${id}`);
  }

  /**
   * Audit Log Operations
   */

  async getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<PolicyAuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('log');

    if (filters?.userId) {
      query.andWhere('log.userId = :userId', { userId: filters.userId });
    }

    if (filters?.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }

    if (filters?.startDate) {
      query.andWhere('log.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters?.endDate) {
      query.andWhere('log.createdAt <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('log.createdAt', 'DESC').limit(filters?.limit || 100);

    return await query.getMany();
  }

  /**
   * Role Operations
   */

  async createRole(roleData: Partial<Role>): Promise<Role> {
    const role = this.roleRepository.create(roleData);
    return await this.roleRepository.save(role);
  }

  async findAllRoles(): Promise<Role[]> {
    return await this.roleRepository.find();
  }
}
