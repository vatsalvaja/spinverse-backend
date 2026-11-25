import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';

/** Global so any admin controller can use `@Audit(...)` without importing this module. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
