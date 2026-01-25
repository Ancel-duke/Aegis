import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { EvaluatePolicyDto } from './dto/evaluate-policy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('policy')
@UseGuards(JwtAuthGuard)
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  /**
   * Evaluate a policy - This can be called by AI Engine or API Pods
   */
  @Post('evaluate')
  @Public() // Make this public or use API key authentication for service-to-service
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 60, limit: 100 })
  async evaluate(@Body() evaluatePolicyDto: EvaluatePolicyDto) {
    return await this.policyService.evaluate(evaluatePolicyDto);
  }

  /**
   * Create a new policy (admin only in production)
   */
  @Post()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 60, limit: 20 })
  async create(@Body() createPolicyDto: CreatePolicyDto) {
    return await this.policyService.createPolicy(createPolicyDto);
  }

  /**
   * Get all policies
   */
  @Get()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 60, limit: 30 })
  async findAll() {
    return await this.policyService.findAllPolicies();
  }

  /**
   * Get policy by ID
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.policyService.findPolicyById(id);
  }

  /**
   * Update a policy
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePolicyDto: UpdatePolicyDto,
  ) {
    return await this.policyService.updatePolicy(id, updatePolicyDto);
  }

  /**
   * Delete a policy
   */
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.policyService.deletePolicy(id);
    return { message: 'Policy deleted successfully' };
  }

  /**
   * Get audit logs
   */
  @Get('audit/logs')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 60, limit: 20 })
  async getAuditLogs(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: number,
  ) {
    return await this.policyService.getAuditLogs({
      userId,
      action,
      limit: limit ? parseInt(limit.toString()) : 100,
    });
  }

  /**
   * Get all roles
   */
  @Get('roles/list')
  async getRoles() {
    return await this.policyService.findAllRoles();
  }
}
