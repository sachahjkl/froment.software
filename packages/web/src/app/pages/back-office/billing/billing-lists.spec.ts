import { provideHttpClient } from '@angular/common/http';
import { type Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService } from '@app/i18n.service';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight } from '@shared/search-highlight';
import { BulkSelection } from '@shared/bulk-selection/bulk-selection';
import { Billing } from './billing';
import { BillingPdf } from './billing-pdf';
import { ReceiptList } from '../receipt-list/receipt-list';
import { CreditNotes } from '../credit-notes/credit-notes';
import { RefundList } from '../refund-list/refund-list';
import {
  creditFixture,
  inputValue,
  invoiceFixture,
  paymentFixture,
  submitForm,
} from './billing.spec-helper';

describe('Billing lists', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
  });
  afterEach(() => {
    scrolling.restore();
    vi.restoreAllMocks();
  });
  const pluralText = [
    {
      language: 'fr',
      results: ['0 résultat', '1 résultat', '2 résultats'],
      selections: ['0 facture sélectionnée', '1 facture sélectionnée', '2 factures sélectionnées'],
      downloads: ['Télécharger le PDF (0)', 'Télécharger le PDF (1)', 'Télécharger les PDF (2)'],
    },
    {
      language: 'en',
      results: ['0 results', '1 result', '2 results'],
      selections: ['0 invoices selected', '1 invoice selected', '2 invoices selected'],
      downloads: ['Download PDFs (0)', 'Download PDF (1)', 'Download PDFs (2)'],
    },
  ] as const;
  for (const text of pluralText) {
    for (const count of [0, 1, 2] as const) {
      it(`${text.language}: formats ${count} results and selected invoices`, () => {
        const i18n = TestBed.inject(I18nService);
        i18n.language.set(text.language);
        expect(i18n.plural('billingWorkspace.count', { count })).toBe(text.results[count]);
        expect(i18n.plural('billingWorkspace.selection', { count })).toBe(text.selections[count]);
        expect(i18n.plural('backOffice.billing.bulkExport', { count })).toBe(text.downloads[count]);
      });
    }
  }
  const invoice = invoiceFixture();
  const context = {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: 'Réparation moteur',
    clientId: invoice.clientId,
    clientDisplayName: 'Équipe 2',
    orderId: invoice.orderId,
    orderReference: invoice.orderReference,
  };
  const cases = [
    {
      component: Billing,
      method: 'list',
      countKey: 'entityList.invoices',
      column: 6,
      sort: 'total',
      filename: 'invoices.csv',
      headings: 7,
      period: 'billingWorkspace.duePeriod',
      dateField: 'dueDate',
      date: '2026-09-20',
      entry: {
        ...invoice,
        ...context,
        id: invoice.id,
        currency: 'EUR',
        dueDate: '2026-09-20',
        updatedAt: '2026-08-20T06:00:00.000Z',
        totalCents: 1200,
        recordedPaidCents: 0,
      },
    },
    {
      component: ReceiptList,
      method: 'receipts',
      countKey: 'entityList.receipts',
      reload: (injector: Injector) => injector.get(ReceiptList)['load'](),
      rows: (injector: Injector) => injector.get(ReceiptList)['rows'](),
      column: 6,
      sort: 'amount',
      filename: 'receipts.csv',
      headings: 7,
      period: 'billingWorkspace.receiptPeriod',
      dateField: 'paidOn',
      date: '2026-08-20',
      entry: { ...paymentFixture(), ...context },
    },
    {
      component: CreditNotes,
      method: 'credits',
      countKey: 'entityList.credits',
      reload: (injector: Injector) => injector.get(CreditNotes)['load'](),
      rows: (injector: Injector) => injector.get(CreditNotes)['rows'](),
      column: 4,
      sort: 'amount',
      filename: 'credit-notes.csv',
      headings: 5,
      period: 'billingWorkspace.creditPeriod',
      dateField: 'issuedAt',
      date: '2026-08-21',
      entry: { ...creditFixture().creditNote, ...context, issuedAt: '2026-08-20T23:30:00.000Z' },
    },
    {
      component: RefundList,
      method: 'refunds',
      countKey: 'entityList.refunds',
      reload: (injector: Injector) => injector.get(RefundList)['load'](),
      rows: (injector: Injector) => injector.get(RefundList)['rows'](),
      column: 5,
      sort: 'amount',
      filename: 'refunds.csv',
      headings: 6,
      period: 'billingWorkspace.refundPeriod',
      dateField: 'refundedOn',
      date: '2026-08-22',
      entry: { ...paymentFixture(), ...context, refundedOn: '2026-08-22' },
    },
  ] as const;
  async function setupFilters(item: (typeof cases)[number]) {
    const entries = [
      item.entry,
      {
        ...item.entry,
        id: '01ARZ3NDEKTSV4RRFFQ69G5FC1',
        clientId: '01ARZ3NDEKTSV4RRFFQ69G5FC2',
        clientDisplayName: 'Plomberie',
        [item.dateField]: item.dateField === 'issuedAt' ? '2026-10-10T06:00:00.000Z' : '2026-10-10',
      },
    ];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([{ path: 'list', component: item.component }]),
        {
          provide: InvoicesApi,
          useValue: {
            [item.method]: async () =>
              item.method === 'list' ? entries : { success: true, result: entries },
          },
        },
      ],
    });
    const harness = await RouterTestingHarness.create(
      `/list?q=reparaton&sort=${item.sort}-desc&source=invoice`,
    );
    const i18n = TestBed.inject(I18nService);
    i18n.language.set('fr');
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    const trigger = root.querySelector<HTMLButtonElement>('app-filter-menu > button')!;
    const openMenu = async () => {
      trigger.click();
      await harness.fixture.whenStable();
      return document.querySelector<HTMLElement>('[role="dialog"]')!;
    };
    const openPanel = async (label: string) => {
      const dialog = await openMenu();
      Array.from(dialog.querySelectorAll<HTMLElement>('[role="menuitem"]'))
        .find((button) => button.textContent?.includes(label))!
        .click();
      await harness.fixture.whenStable();
      return dialog;
    };
    return { harness, root, trigger, openMenu, openPanel, i18n, router: TestBed.inject(Router) };
  }

  it('locks pending PDF downloads and reports a download-specific failure in both languages', async () => {
    const { harness, root, i18n } = await setupFilters(cases[0]);
    root.querySelector<HTMLInputElement>('tbody input[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    const pdf = harness.routeDebugElement!.injector.get(BillingPdf);
    const button = root.querySelector<HTMLButtonElement>('app-bulk-selection button[aria-busy]')!;
    expect(button.disabled).toBe(false);
    pdf.pending.set(true);
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    pdf.pending.set(false);
    pdf.failed.set(true);
    for (const text of pluralText) {
      i18n.language.set(text.language);
      await harness.fixture.whenStable();
      expect(button.disabled).toBe(false);
      expect(root.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
        i18n.t('billingWorkspace.pdfDownloadFailed'),
      );
    }
  });

  for (const item of cases) {
    it(`${item.method}: keeps result and selection labels coupled to their counts in both languages`, async () => {
      const { harness, root, i18n } = await setupFilters(item);
      const search = root.querySelector<HTMLInputElement>('app-list-search input')!;
      const summary = root.querySelector('footer.list-summary [role="status"]')!;
      for (const text of pluralText) {
        i18n.language.set(text.language);
        inputValue(search, 'reparaton');
        await harness.fixture.whenStable();
        expect(summary.textContent?.trim()).toBe(i18n.plural(item.countKey, { count: 2 }));
        if (item.method === 'list') {
          const checkboxes = root.querySelectorAll<HTMLInputElement>(
            'tbody input[type="checkbox"]',
          );
          for (const count of [1, 2] as const) {
            checkboxes[count - 1]!.click();
            await harness.fixture.whenStable();
            const selection = harness
              .routeDebugElement!.query(By.directive(BulkSelection))
              .injector.get(BulkSelection);
            expect(selection.count()).toBe(count);
            expect(selection.selectionLabel()).toBe(text.selections[count]);
            expect(
              root.querySelector('app-bulk-selection button[aria-busy]')?.textContent?.trim(),
            ).toBe(text.downloads[count]);
            expect(root.querySelector('app-bulk-selection > p')?.textContent?.trim()).toBe(
              text.selections[count],
            );
          }
        }
        inputValue(search, 'Plomberie');
        await harness.fixture.whenStable();
        expect(summary.textContent?.trim()).toBe(i18n.plural(item.countKey, { count: 1 }));
        expect(root.querySelector('app-bulk-selection')).toBeNull();
        inputValue(search, 'zzzzzzzzzzzz');
        await harness.fixture.whenStable();
        expect(summary.textContent?.trim()).toBe(i18n.plural(item.countKey, { count: 0 }));
        expect(root.querySelector('app-bulk-selection')).toBeNull();
      }
    });
    it(`${item.method}: searches within one category and commits one URL update`, async () => {
      const { harness, root, trigger, openMenu, openPanel, i18n, router } =
        await setupFilters(item);
      const navigate = vi.spyOn(router, 'navigate');
      const url = router.url;
      if (item.method === 'list') {
        root.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!.click();
        await harness.fixture.whenStable();
      }
      const dialog = await openMenu();
      expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(
        item.method === 'list' ? 5 : item.method === 'credits' ? 2 : 3,
      );
      expect(dialog.querySelector('input, select, details')).toBeNull();
      expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
      const clientCategory = Array.from(
        dialog.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      ).find((button) => button.textContent?.includes(i18n.t('backOffice.invoices.client')))!;
      clientCategory.click();
      await harness.fixture.whenStable();
      let search = dialog.querySelector<HTMLInputElement>('[role="combobox"]')!;
      expect(document.activeElement).toBe(search);
      expect(dialog.querySelector('[role="menu"]')).toBeNull();
      inputValue(search, 'zzzzzzzzzzzz');
      await harness.fixture.whenStable();
      expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(0);
      expect(dialog.textContent).toContain(i18n.t('listWorkspace.noChoices'));
      pressKey(search, 'Escape');
      await harness.fixture.whenStable();
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(router.url).toBe(url);
      expect(navigate).not.toHaveBeenCalled();
      if (item.method === 'list') expect(root.querySelector('app-bulk-selection')).not.toBeNull();
      const panel = await openPanel(i18n.t('backOffice.invoices.client'));
      search = panel.querySelector<HTMLInputElement>('[role="combobox"]')!;
      inputValue(search, 'equipe');
      await harness.fixture.whenStable();
      expect(panel.querySelectorAll('[role="option"]')).toHaveLength(1);
      expect(router.url).toBe(url);
      pressKey(search, 'Home');
      await harness.fixture.whenStable();
      pressKey(search, 'Enter');
      await harness.fixture.whenStable();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(router.parseUrl(router.url).queryParams).toMatchObject({
        q: 'reparaton',
        sort: `${item.sort}-desc`,
        source: 'invoice',
        client: context.clientId,
      });
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(root.querySelector('app-bulk-selection')).toBeNull();
      const restored = await openMenu();
      expect(restored.textContent).toContain('Équipe 2');
      pressKey(restored, 'Escape');
      await harness.fixture.whenStable();
    });
    it(`${item.method}: validates a period before applying both bounds once`, async () => {
      const { harness, root, trigger, openPanel, i18n, router } = await setupFilters(item);
      const navigate = vi.spyOn(router, 'navigate');
      const url = router.url;
      let panel = await openPanel(i18n.t(item.period));
      let dates = panel.querySelectorAll<HTMLInputElement>('input[type="date"]');
      expect(document.activeElement).toBe(dates[0]);
      inputValue(dates[0]!, item.date);
      inputValue(dates[1]!, '2026-01-01');
      await harness.fixture.whenStable();
      expect(navigate).not.toHaveBeenCalled();
      expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
      submitForm(panel);
      await harness.fixture.whenStable();
      expect(panel.querySelector('[role="alert"]')?.textContent).toBe(
        i18n.t('dateRangeFilter.invalidOrder'),
      );
      expect(document.activeElement).toBe(dates[1]);
      expect(router.url).toBe(url);
      expect(navigate).not.toHaveBeenCalled();
      inputValue(dates[0]!, '');
      inputValue(dates[1]!, item.date);
      await harness.fixture.whenStable();
      submitForm(panel);
      await harness.fixture.whenStable();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(router.parseUrl(router.url).queryParams).toMatchObject({
        q: 'reparaton',
        sort: `${item.sort}-desc`,
        source: 'invoice',
        from: '',
        to: item.date,
      });
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(trigger.getAttribute('aria-label')).toMatch(/\(1\)$/);
      navigate.mockClear();
      panel = await openPanel(i18n.t(item.period));
      dates = panel.querySelectorAll<HTMLInputElement>('input[type="date"]');
      expect(dates[0]!.value).toBe('');
      expect(dates[1]!.value).toBe(item.date);
      inputValue(dates[0]!, item.date);
      await harness.fixture.whenStable();
      panel.querySelector<HTMLButtonElement>('button.back')!.click();
      await harness.fixture.whenStable();
      expect(document.activeElement?.textContent).toContain(i18n.t(item.period));
      expect(panel.querySelector('input')).toBeNull();
      pressKey(panel, 'Escape');
      await harness.fixture.whenStable();
      panel = await openPanel(i18n.t(item.period));
      dates = panel.querySelectorAll<HTMLInputElement>('input[type="date"]');
      expect(dates[0]!.value).toBe('');
      inputValue(dates[0]!, item.date);
      await harness.fixture.whenStable();
      expect(navigate).not.toHaveBeenCalled();
      submitForm(panel);
      await harness.fixture.whenStable();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(router.parseUrl(router.url).queryParams).toMatchObject({
        from: item.date,
        to: item.date,
      });
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(trigger.getAttribute('aria-label')).toMatch(/\(1\)$/);
      const csv = harness.routeDebugElement!.query(By.directive(TableExport))
        .componentInstance as TableExport;
      expect(csv.rows()).toHaveLength(1);
      navigate.mockClear();
      Array.from(root.querySelectorAll<HTMLButtonElement>('.chips button[aria-label]'))
        .find((button) => button.textContent?.includes(item.date))!
        .click();
      await harness.fixture.whenStable();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(router.parseUrl(router.url).queryParams).toMatchObject({
        from: '',
        to: '',
        q: 'reparaton',
        sort: `${item.sort}-desc`,
        source: 'invoice',
      });
      expect(root.querySelectorAll('tbody tr')).toHaveLength(2);
      navigate.mockClear();
      panel = await openPanel(i18n.t(item.period));
      dates = panel.querySelectorAll<HTMLInputElement>('input[type="date"]');
      inputValue(dates[0]!, '2026-10-10');
      await harness.fixture.whenStable();
      submitForm(panel);
      await harness.fixture.whenStable();
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(router.parseUrl(router.url).queryParams).toMatchObject({ from: '2026-10-10', to: '' });
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(root.querySelector('tbody')?.textContent).toContain('Plomberie');
    });
    it(`${item.method}: uses Fuse, table sort and an explicit filtered CSV`, async () => {
      const entries = [
        item.entry,
        {
          ...item.entry,
          id: '01ARZ3NDEKTSV4RRFFQ69G5FC1',
          clientDisplayName: 'Equipe 10',
          title: 'Inspection pompe',
          totalCents: 12000,
          amountCents: 12000,
        },
      ];
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideRouter([{ path: 'list', component: item.component }]),
          {
            provide: InvoicesApi,
            useValue: {
              [item.method]: async () =>
                item.method === 'list' ? entries : { success: true, result: entries },
            },
          },
        ],
      });
      const harness = await RouterTestingHarness.create('/list');
      await harness.fixture.whenStable();
      const root = harness.routeNativeElement!;
      expect(root.querySelectorAll('button[appTableSort]')).toHaveLength(item.headings);
      const button = root
        .querySelectorAll<HTMLTableCellElement>('thead th')
        [item.column]!.querySelector('button')!;
      button.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toContain(`sort=${item.sort}-asc`);
      expect(button.parentElement?.getAttribute('aria-sort')).toBe('ascending');
      button.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toContain(`sort=${item.sort}-desc`);
      const csv = harness.routeDebugElement!.query(By.directive(TableExport))
        .componentInstance as TableExport;
      expect(csv.rows()[0]).toContain('Inspection pompe');
      const search = root.querySelector<HTMLInputElement>('app-list-search input')!;
      inputValue(search, 'reparaton');
      await harness.fixture.whenStable();
      expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
      expect(root.querySelector('tbody')?.textContent).toContain('Réparation moteur');
      const highlights = harness.routeDebugElement!.queryAll(By.directive(SearchHighlight));
      expect(
        highlights.some((node) => node.injector.get(SearchHighlight).indices().length > 0),
      ).toBe(true);
      expect(csv.filename()).toBe(item.filename);
      expect(csv.rows()).toHaveLength(1);
      expect(csv.rows()[0]).toContain('Réparation moteur');
      expect(csv.rows().flat()).not.toContain(invoice.id);
      expect(csv.rows().flat()).not.toContain(paymentFixture().requestId);
      expect(csv.columns()).toHaveLength(csv.rows()[0]!.length);
    });
    if (item.method !== 'list') {
      it(`${item.method}: clears stale rows on a limit error without reporting an empty list`, async () => {
        let limited = false;
        TestBed.configureTestingModule({
          providers: [
            provideRouter([{ path: 'list', component: item.component }]),
            {
              provide: InvoicesApi,
              useValue: {
                [item.method]: async () =>
                  limited
                    ? { success: false, status: 413, code: 'invoice.workspace_limit' }
                    : { success: true, result: [item.entry] },
              },
            },
          ],
        });
        const harness = await RouterTestingHarness.create('/list?q=reparaton&sort=amount-desc');
        await harness.fixture.whenStable();
        const root = harness.routeNativeElement!;
        const csv = harness.routeDebugElement!.query(By.directive(TableExport))
          .componentInstance as TableExport;
        const injector = harness.routeDebugElement!.injector;
        const url = TestBed.inject(Router).url;
        expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(csv.rows()).toHaveLength(1);
        limited = true;
        await item.reload(injector);
        await harness.fixture.whenStable();
        expect(root.querySelector('[role="alert"]')?.textContent).toMatch(
          /Trop de résultats|Too many results/,
        );
        expect(root.querySelector('[role="alert"]')?.textContent).toMatch(
          /ne sont pas chargées|is not loaded/,
        );
        expect(root.querySelector('table')).toBeNull();
        expect(root.querySelector('footer.list-summary')?.textContent?.trim() ?? '').toBe('');
        expect(root.textContent).not.toMatch(
          /Aucun élément enregistré|No recorded entries|\b0 (?:résultats?|results?)\b/,
        );
        expect(item.rows(injector)).toEqual([]);
        expect(csv.rows()).toEqual([]);
        expect(csv.emptyHint()).toMatch(/Aucun résultat partiel|No partial results/);
        expect(root.querySelector('app-table-export button')?.getAttribute('aria-disabled')).toBe(
          'true',
        );
        expect(root.querySelector<HTMLInputElement>('app-list-search input')?.value).toBe(
          'reparaton',
        );
        expect(TestBed.inject(Router).url).toBe(url);
        limited = false;
        root.querySelector<HTMLButtonElement>('[appListWorkspace] > button')!.click();
        await harness.fixture.whenStable();
        expect(root.querySelector('[role="alert"]')).toBeNull();
        expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
        expect(csv.rows()).toHaveLength(1);
        expect(TestBed.inject(Router).url).toBe(url);
      });
    }
  }
});
