import { Context, Option, Schema } from 'effect';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ApiTokenPermissionCode, Permissions, RequiredPermissions } from '@froment/contracts';
import { AuditApi } from '../../../contracts/src/audit/api.js';
import {
  GlobalAuditEvent,
  GlobalAuditPage,
  GlobalAuditQuery,
} from '../../../contracts/src/audit/global.js';

const event = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  action: 'quote.created',
  actorUserId: null,
  resourceType: 'quote',
  resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
  occurredAt: '2026-08-20T05:30:00.000Z',
} as const;

describe('Global audit contracts', () => {
  it('requires the existing nondelegable audit permission', () => {
    const endpoint = AuditApi.endpoints.auditEventList;
    expect(endpoint.path).toBe('/api/audit-events');
    expect(endpoint.method).toBe('GET');
    expect(
      Option.getOrUndefined(Context.getOption(endpoint.annotations, RequiredPermissions)),
    ).toEqual(['audit.read']);
    expect(Permissions.auditRead.audiences).toEqual([]);
    expect(Schema.is(ApiTokenPermissionCode)('audit.read')).toBe(false);
  });

  it('decodes HTTP query structure without a deployment-specific page size', () => {
    const query = Schema.decodeUnknownSync(GlobalAuditQuery)({
      limit: '75',
      cursor: event.id,
      direction: 'older',
      action: 'quote.created',
      resourceType: 'quote',
    });
    expect(query.limit).toBe(75);
    expectTypeOf(query.limit).toEqualTypeOf<number | undefined>();
    expectTypeOf<GlobalAuditEvent>().toEqualTypeOf<{
      readonly id: string;
      readonly action: GlobalAuditEvent['action'];
      readonly actorUserId: string | null;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly occurredAt: string;
    }>();
    expect(Schema.decodeUnknownSync(GlobalAuditQuery)({})).toEqual({});
  });

  it.each([
    { cursor: 'not-an-ulid' },
    { cursor: '81ARZ3NDEKTSV4RRFFQ69G5FAV' },
    { cursor: '' },
    { cursor: [event.id, event.id] },
    { limit: '0' },
    { limit: '9007199254740992' },
    { limit: '-1' },
    { limit: '2.5' },
    { limit: 'NaN' },
    { limit: 'Infinity' },
    { limit: ['2', '3'] },
    { action: 'Quote created' },
    { action: ['quote.created', 'invoice.created'] },
    { resourceType: "quote' OR 1=1 --" },
    { resourceType: 'Invoice' },
    { resourceType: 'a'.repeat(41) },
    { resourceType: '' },
    { direction: 'forward' },
    { direction: 'newer' },
  ])('rejects invalid query %j', (query) => {
    expect(() => Schema.decodeUnknownSync(GlobalAuditQuery)(query)).toThrow();
  });

  it('drops free metadata and correlation fields from the public event', () => {
    const decoded = Schema.decodeUnknownSync(GlobalAuditEvent)({
      ...event,
      metadata: { detail: 'excluded' },
      requestId: 'excluded',
      traceId: 'excluded',
      spanId: 'excluded',
      payload: 'excluded',
      secret: 'excluded',
    });
    expect(decoded).toEqual(event);
    expect(() =>
      Schema.decodeUnknownSync(GlobalAuditEvent)({ ...event, actorUserId: 'invalid' }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(GlobalAuditEvent)({ ...event, occurredAt: 123 }),
    ).toThrow();
  });

  it('decodes page structure without imposing a fixed runtime limit', () => {
    const page = {
      items: Array.from({ length: 75 }, () => event),
      previousCursor: null,
      nextCursor: null,
    };
    expect(Schema.decodeUnknownSync(GlobalAuditPage)(page)).toEqual(page);
    expect(() => Schema.decodeUnknownSync(GlobalAuditPage)({ ...page, items: [{}] })).toThrow();
  });
});
