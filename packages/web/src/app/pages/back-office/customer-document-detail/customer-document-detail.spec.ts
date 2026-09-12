import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ClientPortalApi } from '@backoffice/client-portal-api';
import { CustomerDocumentDetail } from './customer-document-detail';
import {
  ClientPortalApiStub,
  invoiceId,
  orderId,
  quoteId,
} from '../client-portal/portal.spec-helper';

async function configure(url: string, api = new ClientPortalApiStub()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: ':kind/:documentId', component: CustomerDocumentDetail }]),
      { provide: ClientPortalApi, useValue: api },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  await harness.fixture.whenStable();
  return { root: harness.routeNativeElement!, harness };
}

describe('CustomerDocumentDetail', () => {
  it('shows the API balance without inventing a payment action or an unavailable PDF', async () => {
    const { root } = await configure(`/invoice/${invoiceId}`);
    const amounts = root.querySelectorAll('.invoice-balance dd');
    expect(amounts[0]?.textContent).toMatch(/120[,.]00/);
    expect(amounts[1]?.textContent).toMatch(/30[,.]00/);
    expect(amounts[2]?.textContent).toMatch(/90[,.]00/);
    expect(root.querySelector('a[download], form, iframe')).toBeNull();
    expect(root.querySelector('.related a')?.getAttribute('href')).toBe(
      `/backoffice/client/documents/order/${orderId}`,
    );
  });

  it('preserves historical payment notes, credits, and void invoice explanations', async () => {
    const api = new ClientPortalApiStub();
    api.invoices = [
      {
        ...api.invoices[0]!,
        status: 'paid',
        recordedPaidCents: 0,
        remainingCents: 0,
        creditedCents: 2000,
        creditNotes: [{ id: '01ARZ3NDEKTSV4RRFFQ69G5FB8', number: 'AV-2026-000001' }],
      },
    ];
    const { root, harness } = await configure(`/invoice/${invoiceId}`, api);
    expect(root.querySelector('.payment-note')?.textContent).toMatch(
      /sans détail complet|without complete payment details/,
    );
    expect(root.querySelector('a[download]')?.getAttribute('href')).toBe(
      '/api/client/credit-notes/01ARZ3NDEKTSV4RRFFQ69G5FB8/pdf',
    );
    const voidId = '01ARZ3NDEKTSV4RRFFQ69G5FAZ';
    api.invoices = [{ ...api.invoices[0]!, id: voidId, status: 'void' }];
    await harness.navigateByUrl(`/invoice/${voidId}`);
    await harness.fixture.whenStable();
    expect(root.querySelector('.payment-note')?.textContent).toMatch(/Aucun montant|No amount/);
  });

  it('only renders a requested document present in the authenticated list', async () => {
    const { root, harness } = await configure(`/quote/${quoteId}`);
    expect(root.querySelector('a[download]')?.getAttribute('href')).toBe(
      `/api/client/quotes/${quoteId}/pdf`,
    );
    await harness.navigateByUrl('/quote/01ARZ3NDEKTSV4RRFFQ69G5FAZ');
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('a[download]')).toBeNull();
  });
});
