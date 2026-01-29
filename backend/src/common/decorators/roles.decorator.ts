import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Role-based access: 'admin' can access all resources, 'user' only own.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
