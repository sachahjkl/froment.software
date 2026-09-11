import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { OrdersApi } from '@backoffice/orders-api';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { CatalogApi } from '@backoffice/catalog-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import {
  commercialTestRoutes,
  control,
  inputValue,
  quoteFixture,
  quoteId,
  selectValue,
} from '../quote-detail/commercial.spec-helper';

describe('Quote editor navigation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  const get = vi.fn();
  const create = vi.fn();
  const createRevision = vi.fn();
  const confirm = vi.fn();
  beforeEach(() => {
    get.mockReset().mockResolvedValue({ success: true, result: quoteFixture });
    create.mockReset();
    createRevision.mockReset();
    confirm.mockReset().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(commercialTestRoutes),
        { provide: QuotesApi, useValue: { get, create, createRevision } },
        { provide: OrdersApi, useValue: { list: async () => [] } },
        {
          provide: ClientsApi,
          useValue: {
            list: async () => [{ id: quoteFixture.clientId, displayName: 'Acme', archived: false }],
          },
        },
        {
          provide: CatalogApi,
          useValue: {
            list: async () => [
              {
                id: 'catalog',
                description: 'Catalog service',
                quantityMilli: 1500,
                unitPriceCents: 12500,
                vatRateBasisPoints: 550,
                archived: false,
              },
            ],
          },
        },
        {
          provide: QuoteConditionPresetsApi,
          useValue: {
            list: async () => [
              { id: 'preset', name: 'Standard payment', conditions: 'Payment within 30 days.' },
            ],
          },
        },
        { provide: Confirmation, useValue: { request: confirm } },
      ],
    });
  });
  async function open(path = `/backoffice/quotes/${quoteId}/edit`) {
    const harness = await RouterTestingHarness.create(path);
    await harness.fixture.whenStable();
    return { harness, root: harness.fixture.nativeElement as HTMLElement };
  }
  it('keeps submit available and focuses the first invalid field', async () => {
    const { harness, root } = await open('/backoffice/quotes/new');
    const save = control<HTMLButtonElement>(root, 'button[type="submit"]');
    expect(save.disabled).toBe(false);
    save.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('#quote-client'));
    expect(create).not.toHaveBeenCalled();
    expect(root.textContent).toMatch(/obligatoire|required/i);
  });
  it('uses the saved version and keeps input on a conflict', async () => {
    createRevision.mockResolvedValue({ success: false, code: 'quote.version_conflict' });
    const { harness, root } = await open();
    inputValue(root, '#quote-name', 'Changed title');
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(createRevision).toHaveBeenCalledWith(
      quoteId,
      expect.objectContaining({ expectedVersion: 2, title: 'Changed title' }),
    );
    expect(control<HTMLInputElement>(root, '#quote-name').value).toBe('Changed title');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('.send-quote')).toBeNull();
  });
  it('blocks pending navigation and sends one save request', async () => {
    let resolve!: (value: { success: true; result: typeof quoteFixture }) => void;
    createRevision.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { harness, root } = await open();
    const button = control<HTMLButtonElement>(root, 'button[type="submit"]');
    button.click();
    button.click();
    await vi.waitFor(() => expect(createRevision).toHaveBeenCalledTimes(1));
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(TestBed.inject(Router).url).toContain('/edit');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    resolve({ success: true, result: quoteFixture });
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/backoffice/quotes/${quoteId}/summary`);
  });
  it('asks before leaving a dirty editor through the real guard', async () => {
    const { harness, root } = await open();
    inputValue(root, '#quote-name', 'Unsaved title');
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(confirm).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toContain('/edit');
    confirm.mockResolvedValue(true);
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/backoffice/affaires');
  });
  it('keeps the validated list context after saving a revision', async () => {
    createRevision.mockResolvedValue({ success: true, result: quoteFixture });
    const { harness, root } = await open(
      `/backoffice/quotes/${quoteId}/edit?q=Audit&stage=draft&client=${quoteFixture.clientId}&view=active&sort=amount-desc&returnUrl=https://invalid.test`,
    );
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    expect(router.url).toContain(`/backoffice/quotes/${quoteId}/summary?`);
    expect(router.parseUrl(router.url).queryParams).toEqual({
      q: 'Audit',
      stage: 'draft',
      client: quoteFixture.clientId,
      view: 'active',
      sort: 'amount-desc',
    });
  });
  it('copies catalog values and selects conditions through the searchable picker', async () => {
    const { harness, root } = await open();
    control<HTMLButtonElement>(root, '.catalog-picker button').click();
    await harness.fixture.whenStable();
    inputValue(document, '[role="dialog"] input[type="search"]', 'service');
    await harness.fixture.whenStable();
    control<HTMLButtonElement>(document, '[role="dialog"] button.option').click();
    await harness.fixture.whenStable();
    const lines = root.querySelectorAll('.document-line');
    expect(lines).toHaveLength(2);
    expect(Array.from(lines[1]?.querySelectorAll('input') ?? [], (input) => input.value)).toEqual([
      'Catalog service',
      '1.500',
      '125.00',
      '5.50',
    ]);
    control<HTMLButtonElement>(root, '.conditions-section app-object-picker button').click();
    await harness.fixture.whenStable();
    inputValue(document, '[role="dialog"] input[type="search"]', 'standard');
    await harness.fixture.whenStable();
    control<HTMLButtonElement>(document, '[role="dialog"] button.option').click();
    await harness.fixture.whenStable();
    expect(control<HTMLElement>(root, '#quote-conditions').textContent).toBe(
      'Payment within 30 days.',
    );
  });
  it('limits preset descriptions without truncating the copied conditions', async () => {
    const conditions = 'Payment conditions. '.repeat(100);
    TestBed.overrideProvider(QuoteConditionPresetsApi, {
      useValue: { list: async () => [{ id: 'preset', name: 'Long conditions', conditions }] },
    });
    const { harness, root } = await open();
    control<HTMLButtonElement>(root, '.conditions-section app-object-picker button').click();
    await harness.fixture.whenStable();
    const option = control<HTMLButtonElement>(document, '[role="dialog"] button.option');
    expect(control<HTMLSpanElement>(option, 'span').textContent?.length).toBe(160);
    option.click();
    await harness.fixture.whenStable();
    expect(control<HTMLElement>(root, '#quote-conditions').textContent).toBe(conditions);
  });
  it('preselects an active client from the client profile link without making the form dirty', async () => {
    const { harness, root } = await open(
      `/backoffice/quotes/new?clientId=${quoteFixture.clientId}`,
    );
    expect(control<HTMLSelectElement>(root, '#quote-client').value).toBe(quoteFixture.clientId);
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    await harness.fixture.whenStable();
    expect(confirm).not.toHaveBeenCalled();
  });
  it.each(['invalid', '01ARZ3NDEKTSV4RRFFQ69G5FB2', quoteFixture.clientId])(
    'does not preselect an invalid, missing or archived client: %s',
    async (id) => {
      TestBed.overrideProvider(ClientsApi, {
        useValue: {
          list: async () => [
            { id: quoteFixture.clientId, displayName: 'Archived client', archived: true },
          ],
        },
      });
      const { root } = await open(`/backoffice/quotes/new?clientId=${id}`);
      expect(control<HTMLSelectElement>(root, '#quote-client').value).toBe('');
    },
  );
  it('shows a field error for a zero quantity', async () => {
    const { harness, root } = await open();
    inputValue(root, 'input[inputmode="decimal"]', '0');
    await harness.fixture.whenStable();
    expect(root.textContent).toMatch(/quantité positive|positive quantity/);
  });
  it('rejects malformed URLs instead of opening a creation form', async () => {
    const { root } = await open('/backoffice/quotes/invalid/edit');
    expect(root.querySelector('form')).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
  it('does not submit a second creation after an uncertain response', async () => {
    create.mockResolvedValue({ success: false, code: 'quote.error' });
    const { harness, root } = await open('/backoffice/quotes/new');
    const client = control<HTMLSelectElement>(root, '#quote-client');
    selectValue(client, quoteFixture.clientId);
    inputValue(root, '#quote-name', 'New quote');
    inputValue(root, '.document-line input', 'Audit');
    await harness.fixture.whenStable();
    control<HTMLButtonElement>(root, 'button[type="submit"]').click();
    await harness.fixture.whenStable();
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      clientId: quoteFixture.clientId,
      title: 'New quote',
      conditions: '',
      lines: [
        { description: 'Audit', quantityMilli: 1000, unitPriceCents: 0, vatRateBasisPoints: 2000 },
      ],
    });
    expect(control<HTMLButtonElement>(root, 'button[type="submit"]').disabled).toBe(true);
    expect(control<HTMLInputElement>(root, '#quote-name').value).toBe('New quote');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    control<HTMLFormElement>(root, 'form').dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true,
      }),
    );
    await harness.fixture.whenStable();
    expect(create).toHaveBeenCalledOnce();
    await TestBed.inject(Router).navigateByUrl('/backoffice/affaires');
    expect(confirm).toHaveBeenCalledOnce();
    expect(TestBed.inject(Router).url).toBe('/backoffice/quotes/new');
  });
  it('ignores a late response after the route changes', async () => {
    let resolve!: (value: { success: true; result: typeof quoteFixture }) => void;
    get.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const harness = await RouterTestingHarness.create(`/backoffice/quotes/${quoteId}/edit`);
    await vi.waitFor(() => expect(get).toHaveBeenCalledOnce());
    const otherId = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
    get.mockResolvedValue({
      success: true,
      result: {
        ...quoteFixture,
        id: otherId,
        currentRevision: { ...quoteFixture.currentRevision, title: 'Newest quote' },
      },
    });
    await harness.navigateByUrl(`/backoffice/quotes/${otherId}/edit`);
    try {
      await vi.waitFor(() =>
        expect(control<HTMLInputElement>(harness.fixture.nativeElement, '#quote-name').value).toBe(
          'Newest quote',
        ),
      );
    } finally {
      resolve({ success: true, result: quoteFixture });
    }
    await harness.fixture.whenStable();
    expect(control<HTMLInputElement>(harness.fixture.nativeElement, '#quote-name').value).toBe(
      'Newest quote',
    );
  });
});
