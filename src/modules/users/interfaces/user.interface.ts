import { User } from '@prisma/client';
import { Role } from '../../../common/enums/role.enum';

/** A user without credentials; the only shape allowed to leave the service layer. */
export type SafeUser = Omit<User, 'passwordHash'>;

export interface CreateUserData {
  name: string;
  /** Already normalised (trimmed, lower-cased). */
  email: string;
  passwordHash: string;
  /** Defaults to USER. Only the hierarchy service passes MASTER or CLIENT; public registration never does. */
  role?: Role;
  /** The owning MASTER for a CLIENT. Always set server-side from the authenticated master, never from a request body. */
  parentId?: string;
}

/** Fields that may change after registration. `passwordHash` is only ever set by the hierarchy service (a master/super admin resetting a managed account). */
export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
  passwordHash?: string;
  deletedAt?: Date;
}

export interface UserListFilter {
  /** Case-insensitive match on name or email. */
  search?: string;
  role?: Role;
  isActive?: boolean;
  /** Only the clients of this master. */
  parentId?: string;
}
