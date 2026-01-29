import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuditService } from '../audit/audit.service';
import { AuditEventType } from '../audit/entities/audit-event.entity';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

export interface UserChangeContext {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async create(
    createUserDto: CreateUserDto,
    ctx?: UserChangeContext,
  ): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 10);
    const hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);

    const user = this.userRepository.create({
      ...createUserDto,
      password: hashedPassword,
    });

    const savedUser = await this.userRepository.save(user);
    await this.auditService.logUserChange({
      eventType: AuditEventType.USER_CREATE,
      userId: ctx?.actorId ?? savedUser.id,
      entityId: savedUser.id,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      details: { email: savedUser.email },
    });
    this.logger.log(`User created: ${savedUser.id}`);

    return savedUser;
  }

  async findAll(): Promise<User[]> {
    return await this.userRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    ctx?: UserChangeContext,
  ): Promise<User> {
    const user = await this.findOne(id);

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);

    await this.auditService.logUserChange({
      eventType: AuditEventType.USER_UPDATE,
      userId: ctx?.actorId ?? id,
      entityId: id,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      details: { fields: Object.keys(updateUserDto) },
    });
    this.logger.log(`User updated: ${updatedUser.id}`);
    return updatedUser;
  }

  async remove(id: string, ctx?: UserChangeContext): Promise<void> {
    const user = await this.findOne(id);
    await this.auditService.logUserChange({
      eventType: AuditEventType.USER_DELETE,
      userId: ctx?.actorId ?? id,
      entityId: id,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      details: { email: user.email },
    });
    await this.userRepository.remove(user);
    this.logger.log(`User deleted: ${id}`);
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    ctx?: UserChangeContext,
  ): Promise<void> {
    const user = await this.findOne(id);
    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }
    const saltRounds = this.configService.get<number>('BCRYPT_ROUNDS', 10);
    const hashedPassword = await bcrypt.hash(dto.newPassword, saltRounds);
    await this.userRepository.update(id, { password: hashedPassword });
    await this.auditService.logUserChange({
      eventType: AuditEventType.USER_PASSWORD_CHANGE,
      userId: ctx?.actorId ?? id,
      entityId: id,
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
    });
    this.logger.log(`Password changed for user: ${id}`);
  }

  async updateRefreshToken(userId: string, refreshToken: string | null): Promise<void> {
    const hashedToken = refreshToken
      ? await bcrypt.hash(refreshToken, 10)
      : null;

    await this.userRepository.update(userId, {
      refreshToken: hashedToken,
    });
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }
}
