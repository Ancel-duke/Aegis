import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { PredictDto } from './dto/predict.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('predict')
  @Public()
  async predict(@Body() dto: PredictDto) {
    return await this.aiService.predict(dto);
  }

  @Get('metrics')
  @Public()
  async metrics() {
    return await this.aiService.getMetrics();
  }
}
