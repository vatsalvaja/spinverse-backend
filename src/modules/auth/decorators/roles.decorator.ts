import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../common/enums/role.enum';
import { ROLES_KEY } from '../constants/auth.constants';

/** Restricts a route (or controller) to the given roles. Prefer `@Auth(Role.ADMIN)`. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
