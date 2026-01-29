import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    avatar: '',
    isActive: true,
    refreshToken: null as string | null,
    passwordResetToken: null as string | null,
    passwordResetTokenExpiresAt: null as Date | null,
    preferences: {},
    roles: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserService = {
    findAll: jest.fn().mockResolvedValue([mockUser]),
    findOne: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn().mockResolvedValue(mockUser),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return the current user', () => {
      const result = controller.getProfile(mockUser);
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const result = await controller.findAll();
      expect(result).toEqual([mockUser]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single user', async () => {
      const result = await controller.findOne(mockUser.id);
      expect(result).toEqual(mockUser);
      expect(service.findOne).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updateDto: UpdateUserDto = { firstName: 'Jane' };
      const mockReq = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      const result = await controller.update(mockUser.id, updateDto, mockUser, mockReq);
      expect(result).toEqual(mockUser);
      expect(service.update).toHaveBeenCalledWith(mockUser.id, updateDto, expect.any(Object));
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      const mockReq = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      await controller.remove(mockUser.id, mockUser, mockReq);
      expect(service.remove).toHaveBeenCalledWith(mockUser.id, expect.any(Object));
    });
  });
});
