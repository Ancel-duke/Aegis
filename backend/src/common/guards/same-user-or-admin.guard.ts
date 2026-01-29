import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { RoleType } from '../../policy/entities/role.entity';

@Injectable()
export class SameUserOrAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const paramId = request.params?.id;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const isAdmin = (user.roles || []).some(
      (r: { name?: string }) => r.name === RoleType.ADMIN,
    );
    if (isAdmin) {
      return true;
    }

    if (paramId && user.id === paramId) {
      return true;
    }

    throw new ForbiddenException('You can only access your own resource');
  }
}
