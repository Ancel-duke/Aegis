import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
  ClassSerializerInterceptor,
  UseInterceptors,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from './entities/user.entity';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { SameUserOrAdminGuard } from '../common/guards/same-user-or-admin.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RoleType } from '../policy/entities/role.entity';

function requestContext(req: Request, userId: string) {
  return {
    actorId: userId,
    ipAddress: req.ip ?? req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

@Controller('users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(RateLimitGuard)
  @RateLimit({ ttl: 60, limit: 30 })
  getProfile(@GetUser() user: User) {
    return user;
  }

  @Post()
  @UseGuards(RolesGuard, RateLimitGuard)
  @Roles(RoleType.ADMIN)
  @RateLimit({ ttl: 60, limit: 20 })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createUserDto: CreateUserDto, @GetUser() user: User, @Req() req: Request) {
    return this.userService.create(createUserDto, requestContext(req, user.id));
  }

  @Get()
  @UseGuards(RolesGuard, RateLimitGuard)
  @Roles(RoleType.ADMIN)
  @RateLimit({ ttl: 60, limit: 20 })
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @UseGuards(SameUserOrAdminGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id/password')
  @UseGuards(SameUserOrAdminGuard)
  @HttpCode(HttpStatus.OK)
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changePasswordDto: ChangePasswordDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.userService.changePassword(
      id,
      changePasswordDto,
      requestContext(req, user.id),
    );
  }

  @Patch(':id')
  @UseGuards(SameUserOrAdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.userService.update(id, updateUserDto, requestContext(req, user.id));
  }

  @Delete(':id')
  @UseGuards(SameUserOrAdminGuard)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
    @Req() req: Request,
  ) {
    return this.userService.remove(id, requestContext(req, user.id));
  }
}
