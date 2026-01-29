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
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { PolicyService } from './policy.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { EvaluatePolicyDto } from './dto/evaluate-policy.dto';
import { PolicyType } from './entities/policy.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('policy')
@UseGuards(JwtAuthGuard)
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  /**
   * Evaluate a policy via GET - action and user details as query params
   */
  @Get('evaluate')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 60, limit: 100 })
  async evaluateGet(
    @Query('action') action: string,
    @Query('resource') resource: string,
    @Query('type') type: string,
    @Query('userId') userId?: string,
    @Query('role') role?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('userAgent') userAgent?: string,
    @Req() req?: Request,
  ) {
    if (!action || !resource || !type) {
      throw new BadRequestException(
        'Query params action, resource, and type are required',
      );
    }
    const validTypes = Object.values(PolicyType);
    if (!validTypes.includes(type as PolicyType)) {
      throw new BadRequestException(
        `type must be one of: ${validTypes.join(', ')}`,
      );
    }
    const dto: EvaluatePolicyDto = {
      action,
      resource,
      type: type as PolicyType,
      context: {
        userId,
        role,
        ipAddress: ipAddress ?? req?.ip ?? req?.socket?.remoteAddress,
        userAgent: userAgent ?? req?.get?.('user-agent'),
      },
    };
    return await this.policyService.evaluate(dto);
  }

  /**
   * Evaluate a policy via POST - full body
   */
  @Post('evaluate')
  @Public()
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
