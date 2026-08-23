import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { AuditEvent } from './contracts.js';

describe('AuditEvent', () => {
  it('accepts a bounded structured event', () => {
    const event = Schema.decodeUnknownSync(AuditEvent)({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      action: 'quote.revised',
      actorUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      resourceType: 'quote',
      resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      requestId: '45b0257f-8a17-40d8-bb8d-f7bc6bc50f4a',
      traceId: '0123456789abcdef0123456789abcdef',
      spanId: '0123456789abcdef',
      occurredAt: '2026-08-20T05:30:00.000Z',
      metadata: { version: '2' },
    });

    expect(event.action).toBe('quote.revised');
  });

  it('rejects an invalid action and oversized metadata', () => {
    const base = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      action: 'quote.revised',
      actorUserId: null,
      resourceType: 'quote',
      resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      requestId: null,
      traceId: null,
      spanId: null,
      occurredAt: '2026-08-20T05:30:00.000Z',
      metadata: {},
    };

    expect(() =>
      Schema.decodeUnknownSync(AuditEvent)({ ...base, action: 'Quote revised' }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(AuditEvent)({
        ...base,
        metadata: { detail: 'a'.repeat(501) },
      }),
    ).toThrow();
  });
});
