import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutorService } from './executor.service';
import { ExecuteActionDto } from './dto/execute-action.dto';
import { Request } from 'express';

@Controller('executor')
@UseGuards(ThrottlerGuard)
export class ExecutorController {
  constructor(private readonly executorService: ExecutorService) {}

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeAction(@Body() dto: ExecuteActionDto, @Req() req: Request) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return await this.executorService.executeAction(dto, ipAddress);
  }

  @Post('generate-signature')
  @HttpCode(HttpStatus.OK)
  generateSignature(
    @Body()
    body: {
      actionType: string;
      actionParams: any;
      requestedBy: string;
    },
  ) {
    const signature = this.executorService.generateSignature(
      body.actionType as any,
      body.actionParams,
      body.requestedBy,
    );

    return { signature };
  }
}
