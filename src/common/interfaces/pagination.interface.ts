import { SortOrder } from '../enums/sort-order.enum';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** `data` of every paginated list endpoint. */
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface SortParams<TField extends string> {
  field: TField;
  order: SortOrder;
}
