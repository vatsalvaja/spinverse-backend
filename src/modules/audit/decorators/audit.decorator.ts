import { SetMetadata, UseInterceptors, applyDecorators } from '@nestjs/common';
import { AUDIT_OPTIONS_KEY } from '../constants/audit.constants';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AuditOptions } from '../interfaces/audit.interface';

/**
 * Records the admin action in the audit log (see `AuditInterceptor`). Put it on an admin route:
 *
 *   @Audit({ action: AUDIT_ACTIONS.USER_DEACTIVATED, resourceType: AUDIT_RESOURCES.USER, targetParam: 'id' })
 */
export const Audit = (options: AuditOptions): MethodDecorator =>
  applyDecorators(SetMetadata(AUDIT_OPTIONS_KEY, options), UseInterceptors(AuditInterceptor)) as MethodDecorator;
