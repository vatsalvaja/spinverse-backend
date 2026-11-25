import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { SafeUser } from '../../users/interfaces/user.interface';

/** Injects the signed-in user (or one of its fields). Requires `@Auth()` on the route. */
export const CurrentUser = createParamDecorator(
  (field: keyof SafeUser | undefined, context: ExecutionContext) => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return field ? user?.[field] : user;
  },
);
