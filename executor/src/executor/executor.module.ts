import { Module } from '@nestjs/common';
import { ExecutorService } from './executor.service';
import { ExecutorController } from './executor.controller';
import { KubernetesModule } from '../kubernetes/kubernetes.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [KubernetesModule, AuditModule],
  controllers: [ExecutorController],
  providers: [ExecutorService],
  exports: [ExecutorService],
})
export class ExecutorModule {}
