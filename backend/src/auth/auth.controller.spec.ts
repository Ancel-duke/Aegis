import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    signup: jest.fn(),
    login: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
    forgotPassword: jest.fn().mockResolvedValue({
      success: true,
      message: 'Password reset email sent if account exists.',
    }),
    resetPassword: jest.fn().mockResolvedValue({
      success: true,
      message: 'Password updated successfully.',
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword and return success', async () => {
      const dto: ForgotPasswordDto = { email: 'user@example.com' };
      const result = await controller.forgotPassword(dto);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto.email);
      expect(result).toEqual({
        success: true,
        message: 'Password reset email sent if account exists.',
      });
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword and return success', async () => {
      const dto: ResetPasswordDto = {
        token: 'reset-token-123',
        newPassword: 'newSecurePass123',
      };
      const result = await controller.resetPassword(dto);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        dto.token,
        dto.newPassword,
      );
      expect(result).toEqual({
        success: true,
        message: 'Password updated successfully.',
      });
    });
  });
});
