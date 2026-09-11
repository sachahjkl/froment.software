import { TestBed } from '@angular/core/testing';
import { Authentication } from './authentication';
import { ClientCreationStore } from './client-creation-store';

describe('ClientCreationStore', () => {
  afterEach(() => sessionStorage.clear());

  it('restores the exact request for its account and isolates other accounts', async () => {
    let userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Authentication,
          useValue: { currentAccount: async () => ({ userId, mode: 'administrator' }) },
        },
      ],
    });
    const service = TestBed.inject(ClientCreationStore);
    const request = {
      requestId: crypto.randomUUID(),
      displayName: ' Acme ',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
    };
    const first = await service.open();
    first.write(request);
    expect((await service.open()).read()).toEqual(request);
    userId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
    expect((await service.open()).read()).toBeUndefined();
    expect(first.read()).toEqual(request);
    first.clear();
    expect(first.read()).toBeUndefined();
  });

  it('rejects malformed stored requests instead of replacing their identity', async () => {
    const userId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Authentication,
          useValue: { currentAccount: async () => ({ userId, mode: 'administrator' }) },
        },
      ],
    });
    sessionStorage.setItem(`froment.pending.client-creation.${userId}`, '{}');
    const store = await TestBed.inject(ClientCreationStore).open();
    expect(() => store.read()).toThrow();
  });
});
