import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { SortParams } from '../../common/interfaces/pagination.interface';
import { toSortDirection } from '../../common/utils/pagination.util';
import { PrismaService } from '../../database/prisma.service';
import { UserSortField } from './enums/user-sort-field.enum';
import { CreateUserData, SafeUser, UpdateUserData, UserListFilter } from './interfaces/user.interface';

/** Selects every column except `passwordHash`. */
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  parentId: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: SAFE_USER_SELECT });
  }

  /** Returns the password hash too - only for credential verification. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Id, name and e-mail of several users at once (to label rows in admin lists). */
  findSummaries(ids: string[]): Promise<{ id: string; name: string; email: string }[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, email: true } });
  }

  /** Account counts for the dashboard: by status, by role, and recent registrations. */
  async getCounts(now: Date = new Date()): Promise<{
    total: number;
    active: number;
    byRole: Record<string, number>;
    registeredLast7Days: number;
    registeredLast30Days: number;
  }> {
    const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const [total, active, byRole, last7, last30] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isActive: true, deletedAt: null } }),
      this.prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: { _all: true }, orderBy: { role: 'asc' } }),
      this.prisma.user.count({ where: { createdAt: { gte: daysAgo(7) }, deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: daysAgo(30) }, deletedAt: null } }),
    ]);
    return {
      total,
      active,
      byRole: Object.fromEntries(byRole.map((row) => [row.role, row._count._all])),
      registeredLast7Days: last7,
      registeredLast30Days: last30,
    };
  }

  /** New accounts per calendar day (UTC) in a range. */
  async registrationsByDay(range: { from?: Date; to?: Date }): Promise<{ date: string; count: number }[]> {
    const parts: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (range.from) parts.push(Prisma.sql`"createdAt" >= ${range.from}`);
    if (range.to) parts.push(Prisma.sql`"createdAt" <= ${range.to}`);
    return this.prisma.$queryRaw<{ date: string; count: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS "date", COUNT(*)::int AS "count"
      FROM "users"
      WHERE ${Prisma.join(parts, ' AND ')}
      GROUP BY 1
      ORDER BY 1
    `);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email } });
    return count > 0;
  }

  /** True when a user other than `excludeId` already uses `email`. */
  async existsByEmailExcluding(email: string, excludeId: string): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { email, NOT: { id: excludeId } } });
    return count > 0;
  }

  create(data: CreateUserData): Promise<SafeUser> {
    return this.prisma.user.create({ data, select: SAFE_USER_SELECT });
  }

  /** A live (not deleted) account of the given role, optionally owned by one master. */
  findManaged(id: string, role: Role, parentId?: string): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { id, role, deletedAt: null, ...(parentId ? { parentId } : {}) },
      select: SAFE_USER_SELECT,
    });
  }

  /** Number of live clients per master, for a set of masters, plus how many of them are active. */
  async countClientsByMaster(masterIds: string[]): Promise<Map<string, { total: number; active: number }>> {
    const result = new Map<string, { total: number; active: number }>();
    if (masterIds.length === 0) return result;
    const rows = await this.prisma.user.groupBy({
      by: ['parentId', 'isActive'],
      where: { parentId: { in: masterIds }, deletedAt: null },
      _count: { _all: true },
      orderBy: { parentId: 'asc' },
    });
    for (const row of rows) {
      if (!row.parentId) continue;
      const entry = result.get(row.parentId) ?? { total: 0, active: 0 };
      entry.total += row._count._all;
      if (row.isActive) entry.active += row._count._all;
      result.set(row.parentId, entry);
    }
    return result;
  }

  update(id: string, data: UpdateUserData): Promise<SafeUser> {
    return this.prisma.user.update({ where: { id }, data, select: SAFE_USER_SELECT });
  }

  async findMany(params: {
    filter: UserListFilter;
    sort: SortParams<UserSortField>;
    skip: number;
    take: number;
  }): Promise<{ items: SafeUser[]; total: number }> {
    const where = this.buildWhere(params.filter);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: this.buildOrderBy(params.sort),
        skip: params.skip,
        take: params.take,
        select: SAFE_USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  private buildWhere(filter: UserListFilter): Prisma.UserWhereInput {
    const conditions: Prisma.UserWhereInput[] = [];

    if (filter.search) {
      conditions.push({
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
        ],
      });
    }
    if (filter.role) conditions.push({ role: filter.role });
    if (filter.isActive !== undefined) conditions.push({ isActive: filter.isActive });
    if (filter.parentId) conditions.push({ parentId: filter.parentId });
    // soft-deleted accounts never appear in a list
    conditions.push({ deletedAt: null });

    return { AND: conditions };
  }

  /** `id` is the tie-breaker so pages are stable when the sort column has duplicates. */
  private buildOrderBy({ field, order }: SortParams<UserSortField>): Prisma.UserOrderByWithRelationInput[] {
    const direction = toSortDirection(order);

    switch (field) {
      case UserSortField.Name:
        return [{ name: direction }, { id: 'asc' }];
      case UserSortField.Email:
        return [{ email: direction }, { id: 'asc' }];
      case UserSortField.Role:
        return [{ role: direction }, { id: 'asc' }];
      case UserSortField.CreatedAt:
      default:
        return [{ createdAt: direction }, { id: 'asc' }];
    }
  }
}
