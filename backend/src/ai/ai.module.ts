import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { PredictionResult } from './entities/prediction-result.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PredictionResult])],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
