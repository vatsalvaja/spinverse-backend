import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResult } from '../../common/interfaces/pagination.interface';
import { buildPaginatedResult, toSkipTake } from '../../common/utils/pagination.util';
import { AuditRepository } from './audit.repository';
import { AUDIT_ERRORS } from './constants/audit.constants';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditLogView, AuditLogWithActor, AuditRecordInput } from './interfaces/audit.interface';

const toView = (entry: AuditLogWithActor): AuditLogView => ({
  id: entry.id,
  actorId: entry.actorId,
  actor: entry.actor,
  action: entry.action,
  resourceType: entry.resourceType,
  resourceId: entry.resourceId,
  details:
    entry.details !== null && typeof entry.details === 'object' && !Array.isArray(entry.details)
      ? (entry.details as Record<string, unknown>)
      : {},
  success: entry.success,
  ipAddress: entry.ipAddress,
  createdAt: entry.createdAt,
});

/** Records and reads administrator activity. There is deliberately no way to change or remove an entry. */
@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(input: AuditRecordInput): Promise<void> {
    await this.auditRepository.create(input);
  }

  async list(query: ListAuditLogsQueryDto): Promise<PaginatedResult<AuditLogView>> {
    if (query.from && query.to && query.from.getTime() > query.to.getTime()) {
      throw new BadRequestException(AUDIT_ERRORS.INVALID_RANGE);
    }
    const { items, total } = await this.auditRepository.findMany({
      filter: {
        actorId: query.actorId,
        action: query.action,
        resourceType: query.resourceType,
        resourceId: query.resourceId,
        success: query.success,
        from: query.from,
        to: query.to,
      },
      ...toSkipTake(query.page, query.limit),
    });
    return buildPaginatedResult(items.map(toView), total, query.page, query.limit);
  }

  async get(id: string): Promise<AuditLogView> {
    const entry = await this.auditRepository.findById(id);
    if (!entry) throw new NotFoundException(AUDIT_ERRORS.NOT_FOUND);
    return toView(entry);
  }
}
