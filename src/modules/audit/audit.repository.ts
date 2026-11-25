import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditFilter, AuditLogWithActor, AuditRecordInput } from './interfaces/audit.interface';

const WITH_ACTOR = { actor: { select: { id: true, name: true, email: true } } } satisfies Prisma.AuditLogInclude;

/**
 * Append-only: this repository can create and read audit entries and has no update or delete. (The database also
 * rejects any UPDATE or DELETE on `audit_logs` with a trigger.)
 */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: AuditRecordInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        details: input.details as Prisma.InputJsonObject,
        success: input.success,
        ipAddress: input.ipAddress,
      },
    });
  }

  findById(id: string): Promise<AuditLogWithActor | null> {
    return this.prisma.auditLog.findUnique({ where: { id }, include: WITH_ACTOR });
  }

  async findMany(params: {
    filter: AuditFilter;
    skip: number;
    take: number;
  }): Promise<{ items: AuditLogWithActor[]; total: number }> {
    const where = this.buildWhere(params.filter);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: WITH_ACTOR,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }

  private buildWhere(filter: AuditFilter): Prisma.AuditLogWhereInput {
    const conditions: Prisma.AuditLogWhereInput[] = [];
    if (filter.actorId) conditions.push({ actorId: filter.actorId });
    if (filter.action) conditions.push({ action: filter.action });
    if (filter.resourceType) conditions.push({ resourceType: filter.resourceType });
    if (filter.resourceId) conditions.push({ resourceId: filter.resourceId });
    if (filter.success !== undefined) conditions.push({ success: filter.success });
    if (filter.from) conditions.push({ createdAt: { gte: filter.from } });
    if (filter.to) conditions.push({ createdAt: { lte: filter.to } });
    return conditions.length > 0 ? { AND: conditions } : {};
  }
}
