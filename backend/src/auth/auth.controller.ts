import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ClassSerializerInterceptor,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 3600, limit: 5 })
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto, @Req() req: Request) {
    return await this.authService.signup(signupDto, {
      ipAddress: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('login')
  @Public()
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 900, limit: 10 })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    return await this.authService.login(loginDto, {
      ipAddress: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refreshTokens(@GetUser() user: { userId: string; refreshToken: string }) {
    return await this.authService.refreshTokens(user.userId, user.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @GetUser('id') userId: string,
    @Req() req: Request,
  ) {
    await this.authService.logout(userId, {
      ipAddress: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
    return { message: 'Logged out successfully' };
  }
}
