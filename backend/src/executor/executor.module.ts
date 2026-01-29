import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutorService } from './executor.service';
import { ExecutorController } from './executor.controller';
import { ActionAuditLog } from './entities/action-audit-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActionAuditLog])],
  controllers: [ExecutorController],
  providers: [ExecutorService],
  exports: [ExecutorService],
})
export class ExecutorModule {}
