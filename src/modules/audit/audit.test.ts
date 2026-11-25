import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import { AuditService } from './audit.service';
import { capDetails, sanitize } from './audit-details.util';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AuditOptions, AuditRecordInput } from './interfaces/audit.interface';

class FakeAuditService {
  records: AuditRecordInput[] = [];
  failWith: Error | null = null;

  async record(input: AuditRecordInput): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.records.push(input);
  }
}

const makeRequest = (overrides: Record<string, unknown> = {}) => ({
  user: { id: 'admin-1' },
  params: { id: 'target-1' },
  body: { reason: 'because', password: 'hunter2' },
  ip: '203.0.113.7',
  ...overrides,
});

function run(
  options: AuditOptions | undefined,
  request: unknown,
  handler: CallHandler,
  audit: FakeAuditService,
): Promise<unknown> {
  const interceptor = new AuditInterceptor(
    { get: () => options } as unknown as Reflector,
    audit as unknown as AuditService,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
  return lastValueFrom(interceptor.intercept(context, handler) as ReturnType<CallHandler['handle']>);
}

const ok = (value: unknown): CallHandler => ({ handle: () => of(value) });
const failing = (error: Error): CallHandler => ({ handle: () => throwError(() => error) });
const options: AuditOptions = { action: 'USER_DEACTIVATED', resourceType: 'USER', targetParam: 'id' };

describe('AuditInterceptor', () => {
  let audit: FakeAuditService;

  beforeEach(() => {
    audit = new FakeAuditService();
  });

  it('records a successful admin action and returns the result unchanged', async () => {
    const result = await run(options, makeRequest(), ok({ done: true }), audit);

    assert.deepEqual(result, { done: true });
    assert.equal(audit.records.length, 1);
    const [entry] = audit.records;
    assert.equal(entry.actorId, 'admin-1');
    assert.equal(entry.action, 'USER_DEACTIVATED');
    assert.equal(entry.resourceType, 'USER');
    assert.equal(entry.resourceId, 'target-1');
    assert.equal(entry.success, true);
    assert.equal(entry.ipAddress, '203.0.113.7');
    assert.deepEqual((entry.details.params as Record<string, string>).id, 'target-1');
  });

  it('never stores secrets from the request body', async () => {
    await run(options, makeRequest(), ok({}), audit);
    const body = audit.records[0].details.body as Record<string, unknown>;
    assert.equal(body.reason, 'because');
    assert.ok(!('password' in body));
  });

  it('can take the target id from the result (create endpoints) and add a result summary', async () => {
    await run(
      { action: 'GAME_CREATED', resourceType: 'GAME', targetFromResult: true, summarize: (r) => ({ name: (r as { name: string }).name }) },
      makeRequest({ params: {} }),
      ok({ id: 'new-game', name: 'Dragon Vault', secretToken: 'x' }),
      audit,
    );
    assert.equal(audit.records[0].resourceId, 'new-game');
    assert.equal(audit.records[0].details.name, 'Dragon Vault');
    assert.ok(!('secretToken' in audit.records[0].details), 'only the summary is kept, not the whole result');
  });

  it('records refused and conflicting attempts as failures and still throws', async () => {
    await assert.rejects(run(options, makeRequest(), failing(new ForbiddenException('nope')), audit), ForbiddenException);
    await assert.rejects(run(options, makeRequest(), failing(new ConflictException('clash')), audit), ConflictException);
    await assert.rejects(run(options, makeRequest(), failing(new Error('boom')), audit), /boom/);

    assert.equal(audit.records.length, 3);
    assert.ok(audit.records.every((entry) => entry.success === false));
    assert.equal(audit.records[0].details.error, 'nope');
  });

  it('does not record plain client mistakes (400 / 404)', async () => {
    await assert.rejects(run(options, makeRequest(), failing(new BadRequestException('bad')), audit), BadRequestException);
    await assert.rejects(run(options, makeRequest(), failing(new NotFoundException('missing')), audit), NotFoundException);
    assert.equal(audit.records.length, 0);
  });

  it('a problem writing the audit entry never breaks a completed action', async () => {
    audit.failWith = new Error('audit table unavailable');
    const result = await run(options, makeRequest(), ok({ done: true }), audit);
    assert.deepEqual(result, { done: true });
  });

  it('records nothing for routes without @Audit, or without a signed-in user', async () => {
    await run(undefined, makeRequest(), ok({}), audit);
    await run(options, makeRequest({ user: undefined }), ok({}), audit);
    assert.equal(audit.records.length, 0);
  });
});

describe('audit details helpers', () => {
  it('removes sensitive keys at any depth, case-insensitively', () => {
    const clean = sanitize({
      name: 'x',
      Password: 'p',
      nested: { refreshToken: 't', ok: 1, deeper: [{ apiKey: 'k', fine: true }] },
    }) as Record<string, unknown>;
    assert.deepEqual(clean, { name: 'x', nested: { ok: 1, deeper: [{ fine: true }] } });
  });

  it('shortens very long strings', () => {
    assert.equal((sanitize('x'.repeat(2000)) as string).length, 503);
  });

  it('keeps small details and replaces an oversized body with a marker', () => {
    const small = { params: { id: '1' }, body: { a: 1 } };
    assert.deepEqual(capDetails(small), small);

    const big = capDetails({ params: { id: '1' }, body: { blob: 'y'.repeat(10_000) } });
    assert.equal(big.body, '[omitted: too large]');
    assert.deepEqual(big.params, { id: '1' });
  });
});
