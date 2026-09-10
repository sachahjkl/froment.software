import { TestBed } from '@angular/core/testing';
import { EmailTestRequest } from '@froment/contracts';
import { vi } from 'vitest';
import { Authentication } from './authentication';
import { PendingProviderRequests, pendingRequestStore } from './pending-provider-requests';

const request = {
  requestId: '65b77a72-e172-42f3-94bb-e0c72e733c91',
  subject: 'Test',
  body: 'Pending content',
};
beforeEach(() => sessionStorage.clear());

it('preserves request identity and content across store reconstruction', () => {
  const first = pendingRequestStore(sessionStorage, 'pending-test', EmailTestRequest);
  expect(first.read()).toBeUndefined();
  first.write(request);
  const restored = pendingRequestStore(sessionStorage, 'pending-test', EmailTestRequest);
  expect(restored.read()).toEqual(request);
  restored.clear();
  expect(first.read()).toBeUndefined();
});

it('keeps malformed records for review and reports storage failures instead of silently losing recovery', () => {
  sessionStorage.setItem('pending-test', '{"requestId":"invalid"}');
  const store = pendingRequestStore(sessionStorage, 'pending-test', EmailTestRequest);
  expect(() => store.read()).toThrow();
  expect(sessionStorage.getItem('pending-test')).not.toBeNull();
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage is full');
  });
  expect(() => store.write(request)).toThrow('Storage is full');
  write.mockRestore();
});

it('isolates pending requests by account and provider', async () => {
  let userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  TestBed.configureTestingModule({
    providers: [
      {
        provide: Authentication,
        useValue: {
          currentAccount: async () => ({
            userId,
            email: 'admin@example.test',
            mode: 'administrator',
          }),
        },
      },
    ],
  });
  const requests = TestBed.inject(PendingProviderRequests);
  (await requests.email()).write(request);
  expect((await requests.checkout()).read()).toBeUndefined();
  expect((await requests.businessEmail()).read()).toBeUndefined();
  expect((await requests.reminder()).read()).toBeUndefined();
  userId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
  expect((await requests.email()).read()).toBeUndefined();
  userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  expect((await requests.email()).read()).toEqual(request);
});

it('does not read pending requests without an authenticated administrator', async () => {
  TestBed.configureTestingModule({
    providers: [{ provide: Authentication, useValue: { currentAccount: async () => undefined } }],
  });
  await expect(TestBed.inject(PendingProviderRequests).email()).rejects.toThrow(
    'pending_request.storage_unavailable',
  );
});
