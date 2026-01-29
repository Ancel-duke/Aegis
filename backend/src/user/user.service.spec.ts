import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/entities/audit-event.entity';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let auditService: AuditService;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    avatar: null,
    isActive: true,
    refreshToken: null,
    roles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockAuditService = {
    logUserChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: number) => (key === 'BCRYPT_ROUNDS' ? 10 : def)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockRepository },
        { provide: AuditService, useValue: mockAuditService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    auditService = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user and hash password', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const dto: CreateUserDto = {
        email: 'test@example.com',
        password: 'plainPassword123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = await service.create(dto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { email: dto.email },
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(auditService.logUserChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.USER_CREATE,
          entityId: mockUser.id,
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException when email exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return user by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);
      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');
      expect(result).toEqual(mockUser);
    });

    it('should return null when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      const result = await service.findByEmail('none@example.com');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update user and log audit', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser });
      mockRepository.save.mockImplementation((u) => Promise.resolve(u));

      const dto: UpdateUserDto = { firstName: 'Jane' };
      await service.update(mockUser.id, dto, { actorId: mockUser.id });

      expect(mockRepository.save).toHaveBeenCalled();
      expect(auditService.logUserChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.USER_UPDATE,
          entityId: mockUser.id,
          details: { fields: ['firstName'] },
        }),
      );
    });
  });

  describe('remove', () => {
    it('should remove user and log audit', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser });
      mockRepository.remove.mockResolvedValue(undefined);

      await service.remove(mockUser.id, { actorId: mockUser.id });

      expect(mockRepository.remove).toHaveBeenCalled();
      expect(auditService.logUserChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.USER_DELETE,
          entityId: mockUser.id,
        }),
      );
    });
  });

  describe('changePassword', () => {
    it('should update password when current password is valid', async () => {
      const userWithPassword = {
        ...mockUser,
        password: '$2b$10$hashed', // bcrypt hash of 'currentPass123'
      };
      mockRepository.findOne.mockResolvedValue(userWithPassword);
      mockRepository.update.mockResolvedValue(undefined);

      const dto: ChangePasswordDto = {
        currentPassword: 'currentPass123',
        newPassword: 'newPassword456',
      };

      // Mock bcrypt.compare to return true for current password
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue('newHashedPassword');

      await service.changePassword(mockUser.id, dto, { actorId: mockUser.id });

      expect(mockRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({ password: 'newHashedPassword' }),
      );
      expect(auditService.logUserChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.USER_PASSWORD_CHANGE,
          entityId: mockUser.id,
        }),
      );
    });

    it('should throw BadRequestException when current password is wrong', async () => {
      mockRepository.findOne.mockResolvedValue({ ...mockUser, password: 'hashed' });
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(
        service.changePassword(mockUser.id, {
          currentPassword: 'wrong',
          newPassword: 'newPass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
