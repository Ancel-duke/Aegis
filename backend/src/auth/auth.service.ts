import {
  Injectable,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/entities/audit-event.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

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
