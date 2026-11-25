import { User } from '@prisma/client';
import { Role } from '../../../common/enums/role.enum';

/** A user without credentials; the only shape allowed to leave the service layer. */
export type SafeUser = Omit<User, 'passwordHash'>;

export interface CreateUserData {
  name: string;
  /** Already normalised (trimmed, lower-cased). */
  email: string;
  passwordHash: string;
}

/** Fields that may change after registration. Credentials are never part of it. */
export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

export interface UserListFilter {
  /** Case-insensitive match on name or email. */
  search?: string;
  role?: Role;
  isActive?: boolean;
}
