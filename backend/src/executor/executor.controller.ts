import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ExecutorService } from './executor.service';
import { ExecutorActionDto } from './dto/executor-action.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('executor')
export class ExecutorController {
  constructor(private readonly executorService: ExecutorService) {}

  @Post('action')
  @Public()
  @HttpCode(HttpStatus.OK)
  async executeAction(
    @Body() dto: ExecutorActionDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip ?? req.socket?.remoteAddress;
    return await this.executorService.executeAction(dto, ipAddress);
  }

  @Get('health')
  @Public()
  async health() {
    return await this.executorService.getHealth();
  }
}
