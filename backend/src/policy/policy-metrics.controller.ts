import { Controller, Get, UseGuards } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('metrics')
@UseGuards(JwtAuthGuard, RateLimitGuard)
export class PolicyMetricsController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('policy-evaluation-counts')
  @RateLimit({ ttl: 60, limit: 30 })
  getPolicyEvaluationCounts() {
    return this.policyService.getEvaluationCounts();
  }
}
