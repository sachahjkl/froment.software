import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import { AuditEvent } from './audit.js';

describe('AuditEvent', () => {
  it('accepts a bounded structured event', () => {
    const event = Schema.decodeUnknownSync(AuditEvent)({
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      action: 'quote.revised',
      actorUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      resourceType: 'quote',
      resourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
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
