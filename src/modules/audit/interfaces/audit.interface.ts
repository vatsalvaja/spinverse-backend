import { AuditLog } from '@prisma/client';

export interface AuditRecordInput {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: Record<string, unknown>;
  success: boolean;
  ipAddress?: string;
}

export type AuditLogWithActor = AuditLog & { actor: { id: string; name: string; email: string } };

export interface AuditFilter {
  actorId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
}

/** An audit entry as returned by the API. */
export interface AuditLogView {
  id: string;
  actorId: string;
  actor: { id: string; name: string; email: string };
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  success: boolean;
  ipAddress: string | null;
  createdAt: Date;
}

/** Options of the `@Audit()` decorator. */
export interface AuditOptions {
  action: string;
  resourceType: string;
  /** Name of the route parameter that holds the target's id, e.g. `id` or `userId`. */
  targetParam?: string;
  /** Take the target's id from the handler's result (for create endpoints). */
  targetFromResult?: boolean;
  /** Extra facts to keep from the handler's result (kept small: ids, amounts, versions). */
  summarize?: (result: unknown) => Record<string, unknown>;
}
