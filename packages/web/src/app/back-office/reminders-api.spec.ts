import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RemindersApi } from './reminders-api';

it('submits the reviewed invoice version unchanged when retrying a reminder', async () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const api = TestBed.inject(RemindersApi);
  const id = '91ff5717-c394-4708-bef2-6b5f5cafbdab';
  const request = {
    invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    expectedVersion: 2,
    expectedMode: 'simulation' as const,
    language: 'fr' as const,
    sendAt: '2026-10-01T10:00:00.000Z',
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = api.create(id, request);
    const put = http.expectOne(`/api/reminders/${id}`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(request);
    put.flush(
      { _tag: 'ReminderConflict', code: 'reminder.conflict' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(await result).toMatchObject({ success: false, code: 'reminder.conflict' });
    http.verify();
  }
});
