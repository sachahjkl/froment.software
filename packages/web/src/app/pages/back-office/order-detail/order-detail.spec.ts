import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { OrdersApi } from '@backoffice/orders-api';
import { QuotesApi } from '@backoffice/quotes-api';
import {
  commercialTestRoutes,
  control,
  orderFixture,
  quoteFixture,
} from '../quote-detail/commercial.spec-helper';

describe('Order detail', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideRouter(commercialTestRoutes),
        { provide: OrdersApi, useValue: { list: async () => [orderFixture] } },
        {
          provide: QuotesApi,
          useValue: { get: async () => ({ success: true, result: quoteFixture }) },
        },
      ],
    }),
  );
  it('offers an existing PDF to a download-only account without rendering it', async () => {
    TestBed.configureTestingModule({
      providers: [provideAccount(['order.read', 'quote.read', 'document.download'])],
    });
    const renderPdf = vi.fn();
    TestBed.overrideProvider(OrdersApi, {
      useValue: {
        list: async () => [{ ...orderFixture, pdfAvailable: true }],
        renderPdf,
      },
    });
    const harness = await RouterTestingHarness.create(`/backoffice/orders/${orderFixture.id}`);
    await harness.fixture.whenStable();
    expect(
      harness.fixture.nativeElement.querySelector(`a[href="/api/orders/${orderFixture.id}/pdf"]`),
    ).not.toBeNull();
    expect(renderPdf).not.toHaveBeenCalled();
  });
  it('shows the accepted revision instead of the current quote revision', async () => {
    TestBed.overrideProvider(QuotesApi, {
      useValue: {
        get: async () => ({
          success: true,
          result: {
            ...quoteFixture,
            currentRevision: {
              ...quoteFixture.currentRevision,
              title: 'Unaccepted change',
              lines: [],
            },
          },
        }),
      },
    });
    const harness = await RouterTestingHarness.create(`/backoffice/orders/${orderFixture.id}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.textContent).toContain('Audit');
    expect(root.textContent).not.toContain('Unaccepted change');
    expect(root.querySelector('app-quote-lines tbody tr')).not.toBeNull();
    expect(
      root.querySelector(`a[href="/backoffice/invoices/new?orderId=${orderFixture.id}"]`),
    ).not.toBeNull();
    expect(root.querySelector('form')).toBeNull();
  });
  it('opens an existing invoice instead of creating another', async () => {
    TestBed.overrideProvider(OrdersApi, {
      useValue: {
        list: async () => [{ ...orderFixture, invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAF' }],
      },
    });
    const harness = await RouterTestingHarness.create(`/backoffice/orders/${orderFixture.id}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(
      root.querySelector('a[href="/backoffice/invoices/01ARZ3NDEKTSV4RRFFQ69G5FAF"]'),
    ).not.toBeNull();
    expect(root.querySelector('a[href^="/backoffice/invoices/new"]')).toBeNull();
  });
  it('preserves sort and filters when opening the accepted quote revision', async () => {
    const harness = await RouterTestingHarness.create(
      `/backoffice/orders/${orderFixture.id}?q=Audit&stage=ordered&client=${quoteFixture.clientId}&view=active&sort=updated-asc`,
    );
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    control<HTMLAnchorElement>(
      root,
      `a[href^="/backoffice/quotes/${quoteFixture.id}/document?"]`,
    ).click();
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.parseUrl(router.url).queryParams).toEqual({
      q: 'Audit',
      stage: 'ordered',
      client: quoteFixture.clientId,
      view: 'active',
      sort: 'updated-asc',
      version: '2',
    });
    expect(root.querySelector('iframe')?.getAttribute('src')).toContain('/revisions/2/preview');
  });
  it('does not substitute another revision when the accepted revision is missing', async () => {
    TestBed.overrideProvider(QuotesApi, {
      useValue: {
        get: async () => ({ success: true, result: { ...quoteFixture, revisions: [] } }),
      },
    });
    const harness = await RouterTestingHarness.create(`/backoffice/orders/${orderFixture.id}`);
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('app-quote-lines')).toBeNull();
  });
});
