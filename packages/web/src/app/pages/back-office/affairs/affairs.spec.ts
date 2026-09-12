import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AffairsApi } from '@backoffice/affairs-api';
import { ClientsApi } from '@backoffice/clients-api';
import { provideAccount } from '@backoffice/account.spec-helper';
import { vi } from 'vitest';
import { Affairs } from './affairs';
import { detailTabs } from '../quote-detail/commercial.spec-helper';

const open = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FC0',
  requestId: '8599c0a4-45d5-47d8-b0e4-f9b05d5ca48b',
  reference: 'AF-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  clientDisplayName: 'Acme',
  title: 'New engagement',
  status: 'open' as const,
  version: 1,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-20T08:00:00.000Z',
  quoteIds: [],
  orderIds: [],
  invoiceIds: [],
};
const active = {
  ...open,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FC1',
  reference: 'AF-2026-000002',
  quoteIds: ['01ARZ3NDEKTSV4RRFFQ69G5FAW'],
};
const closed = {
  ...open,
  id: '01ARZ3NDEKTSV4RRFFQ69G5FC2',
  reference: 'AF-2026-000003',
  status: 'closed' as const,
};

describe('Affairs', () => {
  const create = vi.fn();
  beforeEach(() => {
    create.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideAccount(),
        provideRouter([
          {
            path: 'backoffice/affairs',
            component: Affairs,
            children: detailTabs('affairs', ['attention', 'active', 'completed', 'all']),
          },
          { path: 'backoffice/affairs/:affairId', component: Affairs },
        ]),
        {
          provide: AffairsApi,
          useValue: {
            list: async () => ({ success: true, result: [open, active, closed] }),
            create,
          },
        },
        {
          provide: ClientsApi,
          useValue: {
            list: async () => [
              { id: open.clientId, displayName: 'Acme', archived: false },
              { id: '01ARZ3NDEKTSV4RRFFQ69G5FAX', displayName: 'Old', archived: true },
            ],
          },
        },
      ],
    });
  });

  it('shows unquoted open affairs in the attention view', async () => {
    const harness = await RouterTestingHarness.create('/backoffice/affairs/attention');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(harness.routeNativeElement!.textContent).toContain(open.reference);
  });

  it('shows closed affairs in the completed view', async () => {
    const harness = await RouterTestingHarness.create('/backoffice/affairs/completed');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.textContent).toContain(closed.reference);
    expect(harness.routeNativeElement!.textContent).not.toContain(active.reference);
  });

  it('reports an API failure', async () => {
    TestBed.overrideProvider(AffairsApi, {
      useValue: { list: async () => ({ success: false, code: 'affair.error' }), create },
    });
    const harness = await RouterTestingHarness.create('/backoffice/affairs/all');
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).not.toBeNull();
  });
});
