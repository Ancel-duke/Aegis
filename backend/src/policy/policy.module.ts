import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PolicyService } from './policy.service';
import { PolicyController } from './policy.controller';
import { PolicyMetricsController } from './policy-metrics.controller';
import { Policy } from './entities/policy.entity';
import { PolicyAuditLog } from './entities/policy-audit-log.entity';
import { Role } from './entities/role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Policy, PolicyAuditLog, Role])],
  controllers: [PolicyController, PolicyMetricsController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
