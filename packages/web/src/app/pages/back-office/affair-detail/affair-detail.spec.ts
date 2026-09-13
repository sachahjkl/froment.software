import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AffairsApi } from '@backoffice/affairs-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { provideAccount } from '@backoffice/account.spec-helper';
import { vi } from 'vitest';
import { AffairDetail } from './affair-detail';
import { detailTabs } from '../quote-detail/commercial.spec-helper';

const affairId = '01ARZ3NDEKTSV4RRFFQ69G5FC0';
const quoteId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const affair = {
  id: affairId,
  requestId: '8599c0a4-45d5-47d8-b0e4-f9b05d5ca48b',
  reference: 'AF-2026-000001',
  clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
  clientDisplayName: 'Acme',
  title: 'Security review',
  status: 'open' as const,
  version: 1,
  createdAt: '2026-08-20T08:00:00.000Z',
  updatedAt: '2026-08-20T08:00:00.000Z',
  quoteIds: [quoteId],
  orderIds: [],
  invoiceIds: [],
};

describe('AffairDetail', () => {
  const update = vi.fn();
  beforeEach(() => {
    update.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideAccount(),
        provideRouter([
          {
            path: 'backoffice/affairs/:affairId',
            component: AffairDetail,
            children: detailTabs('affair-detail', ['overview', 'history']),
          },
        ]),
        {
          provide: AffairsApi,
          useValue: {
            get: async () => ({ success: true, result: affair }),
            events: async () => ({
              success: true,
              result: [
                { id: 'later', action: 'affair.updated', occurredAt: '2026-08-21T08:00:00.000Z' },
                { id: 'earlier', action: 'affair.created', occurredAt: '2026-08-20T08:00:00.000Z' },
              ],
            }),
            update,
          },
        },
        {
          provide: QuotesApi,
          useValue: {
            list: async () => [
              {
                id: quoteId,
                clientId: affair.clientId,
                reference: 'DE-2026-000001',
                title: 'Security review',
              },
            ],
          },
        },
        { provide: OrdersApi, useValue: { list: async () => [] } },
        { provide: InvoicesApi, useValue: { list: async () => [] } },
      ],
    });
  });

  it('shows linked documents and the client link on the overview tab', async () => {
    const harness = await RouterTestingHarness.create(`/backoffice/affairs/${affairId}/overview`);
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    expect(root.textContent).toContain('DE-2026-000001');
    expect(root.querySelector(`a[href="/backoffice/clients/${affair.clientId}"]`)).not.toBeNull();
  });

  it('sorts affair history without changing the response', async () => {
    const harness = await RouterTestingHarness.create(`/backoffice/affairs/${affairId}/history`);
    await harness.fixture.whenStable();
    expect(
      Array.from(harness.routeNativeElement!.querySelectorAll('time'), (time) => time.dateTime),
    ).toEqual(['2026-08-20T08:00:00.000Z', '2026-08-21T08:00:00.000Z']);
  });

  it('shows editing controls only on the overview tab', async () => {
    const harness = await RouterTestingHarness.create(`/backoffice/affairs/${affairId}/overview`);
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement!.querySelectorAll('form')).toHaveLength(1);
  });
});
