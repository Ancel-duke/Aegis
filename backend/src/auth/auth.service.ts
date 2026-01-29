import {
  Injectable,
  UnauthorizedException,
  Logger,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { UserService } from '../user/user.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/entities/audit-event.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from './services/mail.service';
import * as bcrypt from 'bcryptjs';

export interface AuthRequestContext {
  ipAddress?: string;
  userAgent?: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
    private mailService: MailService,
  ) {}

  async signup(
    signupDto: SignupDto,
    ctx?: AuthRequestContext,
  ): Promise<AuthTokens> {
    const user = await this.userService.create(signupDto);
    const tokens = await this.generateTokens(user.id, user.email);

    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.logAuthEvent({
      eventType: AuditEventType.AUTH_SIGNUP,
      userId: user.id,
      email: user.email,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      success: true,
    });
    this.logger.log(`Signup success for user id=${user.id}`);
    return tokens;
  }

  async login(
    loginDto: LoginDto,
    ctx?: AuthRequestContext,
  ): Promise<AuthTokens> {
    const user = await this.userService.findByEmail(loginDto.email);

    if (!user) {
      await this.auditService.logAuthEvent({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        email: loginDto.email,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        success: false,
        reason: 'user_not_found',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.userService.validatePassword(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      await this.auditService.logAuthEvent({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        userId: user.id,
        email: user.email,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        success: false,
        reason: 'invalid_password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await this.auditService.logAuthEvent({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        userId: user.id,
        email: user.email,
        ipAddress: ctx?.ipAddress,
        userAgent: ctx?.userAgent,
        success: false,
        reason: 'account_deactivated',
      });
      throw new ForbiddenException('User account is deactivated');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    await this.auditService.logAuthEvent({
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      userId: user.id,
      email: user.email,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      success: true,
    });
    this.logger.log(`Login success for user id=${user.id}`);
    return tokens;
  }

  async refreshTokens(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.userService.findOne(userId);

    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!refreshTokenMatches) {
      throw new ForbiddenException('Access Denied');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Tokens refreshed for user id=${user.id}`);
    return tokens;
  }

  async logout(userId: string, ctx?: AuthRequestContext): Promise<void> {
    await this.userService.updateRefreshToken(userId, null);
    await this.auditService.logAuthEvent({
      eventType: AuditEventType.AUTH_LOGOUT,
      userId,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      success: true,
    });
    this.logger.log(`Logout for user id=${userId}`);
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await this.userService.validatePassword(
      password,
      user.password,
    );

    if (isPasswordValid) {
      const { password, ...result } = user;
      return result;
    }

    return null;
  }

  async forgotPassword(email: string): Promise<{ success: true; message: string }> {
    const user = await this.userService.findByEmail(email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      const expiresInMinutes = this.configService.get<number>(
        'PASSWORD_RESET_EXPIRY_MINUTES',
        60,
      );
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      await this.userService.setPasswordResetToken(user.id, token, expiresAt);

      const baseUrl = this.configService.get<string>(
        'FRONTEND_URL',
        'http://localhost:3001',
      );
      const resetLink = `${baseUrl}/auth/reset-password?token=${token}`;

      await this.mailService.sendPasswordResetEmail({
        to: user.email,
        resetLink,
        expiresInMinutes,
      });
      this.logger.log(`Password reset email sent for user id=${user.id}`);
    }
    return {
      success: true,
      message: 'Password reset email sent if account exists.',
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: true; message: string }> {
    const user = await this.userService.findByPasswordResetToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }
    if (
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      await this.userService.clearPasswordResetToken(user.id);
      throw new BadRequestException('Invalid or expired reset token');
    }

    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 10);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await this.userService.updatePasswordFromReset(user.id, hashedPassword);

    this.logger.log(`Password reset completed for user id=${user.id}`);
    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  private async generateTokens(userId: string, email: string): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          type: 'access',
        } as JwtPayload,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
        },
      ),
      this.jwtService.signAsync(
        {
          sub: userId,
          email,
          type: 'refresh',
        } as JwtPayload,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
