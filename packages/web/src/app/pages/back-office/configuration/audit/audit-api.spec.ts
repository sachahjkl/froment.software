import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuditApi } from '@backoffice/audit-api';

describe('AuditApi', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('uses GET with exact URL filters and strips additional response fields', async () => {
    const cursor = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    const result = TestBed.inject(AuditApi).list({
      cursor,
      direction: 'newer',
      limit: 2,
      action: 'quote.created',
      resourceType: 'quote',
    });
    const request = TestBed.inject(HttpTestingController).expectOne(
      (request) => request.url === '/api/audit-events',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('cursor')).toBe(cursor);
    expect(request.request.params.get('direction')).toBe('newer');
    expect(request.request.params.get('limit')).toBe('2');
    expect(request.request.params.get('action')).toBe('quote.created');
    expect(request.request.params.get('resourceType')).toBe('quote');
    const event = {
      id: cursor,
      action: 'quote.created',
      actorUserId: null,
      resourceType: 'quote',
      resourceId: cursor,
      occurredAt: '2026-08-20T05:30:00.000Z',
    };
    request.flush({
      items: [{ ...event, metadata: { detail: 'excluded' }, traceId: 'excluded' }],
      previousCursor: null,
      nextCursor: null,
    });
    expect(await result).toEqual({
      success: true,
      result: { items: [event], previousCursor: null, nextCursor: null },
    });
  });

  it('preserves authorization failure without inventing an empty success', async () => {
    const result = TestBed.inject(AuditApi).list({});
    TestBed.inject(HttpTestingController).expectOne('/api/audit-events').flush(
      {
        _tag: 'PermissionDenied',
        code: 'authentication.permission_denied',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    expect(await result).toMatchObject({
      success: false,
      code: 'authentication.permission_denied',
      status: 403,
    });
  });

  it('rejects a malformed event returned with status 200', async () => {
    const result = TestBed.inject(AuditApi).list({});
    TestBed.inject(HttpTestingController)
      .expectOne('/api/audit-events')
      .flush({
        items: [{ action: 'Unknown action' }],
        previousCursor: null,
        nextCursor: null,
      });
    expect(await result).toMatchObject({ success: false, code: 'audit.unavailable' });
  });

  it('preserves the configured page-size refusal as a typed query error', async () => {
    const result = TestBed.inject(AuditApi).list({ limit: 75 });
    TestBed.inject(HttpTestingController)
      .expectOne('/api/audit-events?limit=75')
      .flush(
        { _tag: 'InvalidAuditQuery', code: 'audit.invalid_query' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(await result).toMatchObject({
      success: false,
      code: 'audit.invalid_query',
      status: 400,
    });
  });
});
