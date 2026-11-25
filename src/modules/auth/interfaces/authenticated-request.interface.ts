import { Request } from 'express';
import { SafeUser } from '../../users/interfaces/user.interface';

/** Express request after `JwtAuthGuard` has attached the current user. */
export interface AuthenticatedRequest extends Request {
  user: SafeUser;
}
