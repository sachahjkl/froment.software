import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { provideAccount } from '@backoffice/account.spec-helper';
import { OrdersApi } from '@backoffice/orders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { CatalogApi } from '@backoffice/catalog-api';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { Affairs } from './affairs';
import { AffairDetail } from '../affair-detail/affair-detail';
import {
  commercialTestRoutes,
  control,
  labelControl,
  detailTabs,
  quoteFixture,
  quoteId,
} from '../quote-detail/commercial.spec-helper';

describe('Commercial navigation context', () => {
  it('preserves the list context through the affair, quote, editor and publication without accepting returnUrl', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideAccount(),
        provideRouter([
          {
            path: 'backoffice/affairs',
            component: Affairs,
            children: detailTabs('affairs', ['all', 'attention', 'active', 'completed']),
          },
          {
            path: 'backoffice/affairs/:quoteId',
            component: AffairDetail,
            children: detailTabs('affair-detail', ['overview', 'documents', 'history']),
          },
          ...commercialTestRoutes,
        ]),
        {
          provide: QuotesApi,
          useValue: {
            list: async () => [
              {
                id: quoteId,
                reference: quoteFixture.reference,
                clientId: quoteFixture.clientId,
                clientDisplayName: 'Acme',
                title: 'Audit',
                status: 'draft',
                totalCents: 1200,
                updatedAt: quoteFixture.currentRevision.createdAt,
              },
            ],
            get: async () => ({ success: true, result: quoteFixture }),
            listAffairEvents: async () => [],
          },
        },
        {
          provide: ClientsApi,
          useValue: {
            list: async () => [{ id: quoteFixture.clientId, displayName: 'Acme', archived: false }],
            get: async () => ({ success: true, result: { displayName: 'Acme' } }),
          },
        },
        { provide: OrdersApi, useValue: { list: async () => [] } },
        { provide: InvoicesApi, useValue: { list: async () => [] } },
        { provide: CatalogApi, useValue: { list: async () => [] } },
        { provide: QuoteConditionPresetsApi, useValue: { list: async () => [] } },
      ],
    });
    const harness = await RouterTestingHarness.create(
      `/backoffice/affairs/all?q=Audit&stage=draft&client=${quoteFixture.clientId}&sort=amount-asc&returnUrl=https://invalid.test`,
    );
    await harness.fixture.whenStable();
    const root: HTMLElement = harness.fixture.nativeElement;
    const router = TestBed.inject(Router);
    const context = {
      q: 'Audit',
      stage: 'draft',
      client: quoteFixture.clientId,
      view: 'all',
      sort: 'amount-asc',
    };
    function expectContext(): void {
      expect(router.parseUrl(router.url).queryParams).toEqual(context);
    }
    async function follow(selector: string): Promise<void> {
      control<HTMLAnchorElement>(root, selector).click();
      await harness.fixture.whenStable();
      expectContext();
    }
    await follow('tbody tr td:first-child a');
    await follow(`a[href^="/backoffice/quotes/${quoteId}?"]`);
    await follow('#quote-versions-tab');
    const revisionLink = control<HTMLAnchorElement>(
      root,
      '[aria-labelledby="quote-versions-tab"] tbody tr:first-child a',
    );
    const revisionUrl = new URL(revisionLink.href);
    expect(revisionUrl.pathname).toBe(`/backoffice/quotes/${quoteId}/document`);
    expect(router.parseUrl(revisionUrl.pathname + revisionUrl.search).queryParams).toEqual({
      ...context,
      version: '1',
    });
    revisionLink.click();
    await harness.fixture.whenStable();
    expect(router.url.split('?')[0]).toBe(`/backoffice/quotes/${quoteId}/document`);
    expect(router.parseUrl(router.url).queryParams).toEqual({
      ...context,
      version: '1',
    });
    expect(control<HTMLIFrameElement>(root, 'app-quote-document iframe').getAttribute('src')).toBe(
      `/api/quotes/${quoteId}/revisions/1/preview`,
    );
    await follow(`a[href^="/backoffice/quotes/${quoteId}/edit?"]`);
    await follow('[pageBack] a, a[pageBack]');
    await follow(`a[href^="/backoffice/quotes/${quoteId}/publication?"]`);
    await follow('[pageBack] a, a[pageBack]');
    await follow(`a[href^="/backoffice/affairs/${quoteId}?"]`);
    await follow('[pageBack] a, a[pageBack]');
    expect(router.url).toContain('/backoffice/affairs/all?');
    expect(
      labelControl<HTMLInputElement>(root, TestBed.inject(I18nService).t('commercial.search'))
        .value,
    ).toBe('Audit');
    expect(root.querySelector('#affairs-column-amount')?.getAttribute('aria-sort')).toBe(
      'ascending',
    );
  });
});
