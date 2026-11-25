import { SortOrder } from '../enums/sort-order.enum';
import { PaginatedResult } from '../interfaces/pagination.interface';

/** Converts 1-based `page` / `limit` into Prisma's `skip` / `take`. */
export function toSkipTake(page: number, limit: number): { skip: number; take: number } {
  return { skip: (page - 1) * limit, take: limit };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

/** Maps the API sort order onto Prisma's literal `'asc' | 'desc'`. */
export function toSortDirection(order: SortOrder): 'asc' | 'desc' {
  return order === SortOrder.Desc ? 'desc' : 'asc';
}
