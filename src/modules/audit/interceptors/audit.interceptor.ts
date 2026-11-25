import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, from, mergeMap, throwError } from 'rxjs';
import { AuditService } from '../audit.service';
import { capDetails, sanitize } from '../audit-details.util';
import { AUDIT_OPTIONS_KEY } from '../constants/audit.constants';
import { AuditOptions } from '../interfaces/audit.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

/**
 * Writes an audit entry for routes tagged with `@Audit(...)`: who (the signed-in admin), what (action), on what
 * (target), with which facts (params, sanitised body, a small result summary) and from where (IP address).
 *
 *  - Successful actions are always recorded.
 *  - Refused or failed attempts (403, 409, server errors) are recorded too, with `success: false`. Plain
 *    validation mistakes (400, 404) are not, to keep the log meaningful.
 *  - A problem writing the audit entry is logged but never turns a completed action into an error.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_OPTIONS_KEY, context.getHandler());
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        await this.write(request, options, true, result);
        return result;
      }),
      catchError((error: unknown) => {
        if (!this.isRecordableFailure(error)) return throwError(() => error);
        return from(this.write(request, options, false, undefined, error)).pipe(
          mergeMap(() => throwError(() => error)),
        );
      }),
    );
  }

  private isRecordableFailure(error: unknown): boolean {
    if (!(error instanceof HttpException)) return true; // unexpected failure
    const status = error.getStatus();
    return status === HttpStatus.FORBIDDEN || status === HttpStatus.CONFLICT || status >= HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private async write(
    request: AuthenticatedRequest,
    options: AuditOptions,
    success: boolean,
    result?: unknown,
    error?: unknown,
  ): Promise<void> {
    const actor = request.user;
    if (!actor) return;

    try {
      const details: Record<string, unknown> = {
        params: request.params,
        body: sanitize(request.body),
        ...(success && options.summarize && result !== undefined ? options.summarize(result) : {}),
        ...(error ? { error: error instanceof Error ? error.message : String(error) } : {}),
      };

      let resourceId: string | undefined;
      if (options.targetParam) {
        const value = request.params[options.targetParam];
        resourceId = value === undefined ? undefined : String(value);
      } else if (options.targetFromResult && result && typeof result === 'object') {
        const id = (result as { id?: unknown }).id;
        resourceId = typeof id === 'string' ? id : undefined;
      }

      await this.auditService.record({
        actorId: actor.id,
        action: options.action,
        resourceType: options.resourceType,
        resourceId,
        details: capDetails(details),
        success,
        ipAddress: request.ip,
      });
    } catch (writeError) {
      this.logger.error(
        `Could not write the audit entry for ${options.action} by ${actor.id}: ${writeError instanceof Error ? writeError.message : writeError}`,
      );
    }
  }
}
