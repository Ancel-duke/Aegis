import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from './services/mail.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    refreshToken: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserService = {
    create: jest.fn().mockResolvedValue(mockUser),
    findByEmail: jest.fn().mockResolvedValue(mockUser),
    findOne: jest.fn().mockResolvedValue(mockUser),
    updateRefreshToken: jest.fn().mockResolvedValue(undefined),
    validatePassword: jest.fn().mockResolvedValue(true),
    setPasswordResetToken: jest.fn().mockResolvedValue(undefined),
    clearPasswordResetToken: jest.fn().mockResolvedValue(undefined),
    findByPasswordResetToken: jest.fn().mockResolvedValue(mockUser),
    updatePasswordFromReset: jest.fn().mockResolvedValue(undefined),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string | number) => {
      const config: Record<string, string | number> = {
        JWT_SECRET: 'test-secret',
        JWT_ACCESS_EXPIRATION: '15m',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_REFRESH_EXPIRATION: '7d',
        FRONTEND_URL: 'http://localhost:3001',
        PASSWORD_RESET_EXPIRY_MINUTES: 60,
        BCRYPT_ROUNDS: 10,
      };
      return config[key] ?? defaultValue;
    }),
  };

  const mockAuditService = {
    logAuthEvent: jest.fn().mockResolvedValue(undefined),
  };

  const mockMailService = {
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signup', () => {
    it('should create a new user and return tokens', async () => {
      const signupDto: SignupDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await service.signup(signupDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(userService.create).toHaveBeenCalledWith(signupDto);
      expect(userService.updateRefreshToken).toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(userService.findByEmail).toHaveBeenCalledWith(loginDto.email);
      expect(userService.validatePassword).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUserService.findByEmail.mockResolvedValueOnce(null);

      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token', async () => {
      await service.logout(mockUser.id);
      expect(userService.updateRefreshToken).toHaveBeenCalledWith(
        mockUser.id,
        null,
      );
    });
  });

  describe('forgotPassword', () => {
    it('should return success message when user exists', async () => {
      const result = await service.forgotPassword('test@example.com');
      expect(result).toEqual({
        success: true,
        message: 'Password reset email sent if account exists.',
      });
      expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userService.setPasswordResetToken).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Date),
      );
      expect(mockMailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return same success message when user does not exist', async () => {
      mockUserService.findByEmail.mockResolvedValueOnce(null);
      const result = await service.forgotPassword('unknown@example.com');
      expect(result).toEqual({
        success: true,
        message: 'Password reset email sent if account exists.',
      });
      expect(userService.setPasswordResetToken).not.toHaveBeenCalled();
      expect(mockMailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('should update password and invalidate token', async () => {
      const result = await service.resetPassword('valid-token', 'newPassword123');
      expect(result).toEqual({
        success: true,
        message: 'Password updated successfully.',
      });
      expect(userService.findByPasswordResetToken).toHaveBeenCalledWith(
        'valid-token',
      );
      expect(userService.updatePasswordFromReset).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUserService.findByPasswordResetToken.mockResolvedValueOnce(null);
      await expect(
        service.resetPassword('invalid-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
      expect(userService.updatePasswordFromReset).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for expired token', async () => {
      mockUserService.findByPasswordResetToken.mockResolvedValueOnce({
        ...mockUser,
        passwordResetTokenExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword('expired-token', 'newPassword123'),
      ).rejects.toThrow(BadRequestException);
      expect(userService.clearPasswordResetToken).toHaveBeenCalledWith(
        mockUser.id,
      );
    });
  });
});
