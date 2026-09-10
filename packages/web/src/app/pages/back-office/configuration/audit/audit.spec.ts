import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { AuditApi } from '@backoffice/audit-api';
import { I18nService } from '@app/i18n.service';
import { type GlobalAuditPage } from '@froment/contracts';
import { Audit } from './audit';

const firstId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const lastId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const page: GlobalAuditPage = {
  items: [
    {
      id: firstId,
      action: 'quote.created',
      actorUserId: null,
      resourceType: 'quote',
      resourceId: lastId,
      occurredAt: '2026-08-20T05:30:00.000Z',
    },
  ],
  previousCursor: firstId,
  nextCursor: lastId,
};

const setup = (params: Record<string, string> = {}) => {
  const queryParamMap = new BehaviorSubject(convertToParamMap(params));
  const list = vi.fn<AuditApi['list']>().mockResolvedValue({ success: true, result: page });
  const navigate = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap } },
      { provide: AuditApi, useValue: { list } },
    ],
  });
  const fixture = TestBed.createComponent(Audit);
  return { fixture, list, queryParamMap, navigate, component: fixture.componentInstance };
};

describe('Audit page', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    {
      language: 'fr',
      count: 0,
      loaded: 0,
      summary: '0 événement affiché sur 0 événement chargé.',
      range: '0 événement sur cette page',
    },
    {
      language: 'fr',
      count: 1,
      loaded: 1,
      summary: '1 événement affiché sur 1 événement chargé.',
      range: '1 événement sur cette page',
    },
    {
      language: 'fr',
      count: 2,
      loaded: 2,
      summary: '2 événements affichés sur 2 événements chargés.',
      range: '2 événements sur cette page',
    },
    {
      language: 'fr',
      count: 1,
      loaded: 2,
      summary: '1 événement affiché sur 2 événements chargés.',
      range: '2 événements sur cette page',
    },
    {
      language: 'en',
      count: 0,
      loaded: 0,
      summary: '0 events displayed from 0 loaded events.',
      range: '0 events on this page',
    },
    {
      language: 'en',
      count: 1,
      loaded: 1,
      summary: '1 event displayed from 1 loaded event.',
      range: '1 event on this page',
    },
    {
      language: 'en',
      count: 2,
      loaded: 2,
      summary: '2 events displayed from 2 loaded events.',
      range: '2 events on this page',
    },
    {
      language: 'en',
      count: 1,
      loaded: 2,
      summary: '1 event displayed from 2 loaded events.',
      range: '2 events on this page',
    },
  ] as const)(
    'agrees $count displayed and $loaded loaded events independently in $language',
    async ({ language, count, loaded, summary, range }) => {
      const { fixture, component } = setup({ pageQ: count < loaded ? 'invoice' : '' });
      await fixture.whenStable();
      TestBed.inject(I18nService).language.set(language);
      const event = page.items[0];
      if (!event) throw new Error('Missing audit event fixture');
      component['page'].set({
        items: Array.from({ length: loaded }, (_, index) => ({
          ...event,
          id: index === 0 ? firstId : lastId,
          resourceType: index === 0 ? 'invoice' : 'quote',
        })),
        nextCursor: null,
        previousCursor: null,
      });
      await fixture.whenStable();
      expect(component['table'].rows()).toHaveLength(count);
      const root: HTMLElement = fixture.nativeElement;
      expect(root.querySelector('#audit-page-scope')?.textContent?.replace(/\s+/g, ' ')).toContain(
        summary,
      );
      expect(
        root.querySelector('app-result-navigation')?.textContent?.replace(/\s+/g, ' '),
      ).toContain(range);
    },
  );

  it('renders only local technical events and sends both cursors through the URL', async () => {
    const { fixture, list, component, navigate } = setup({ action: 'quote.created', limit: '2' });
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(list).toHaveBeenCalledWith({ action: 'quote.created', limit: 2 });
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody')?.textContent).toContain('quote.created');
    expect(root.querySelector('tbody a')).toBeNull();
    expect(root.querySelector('time')?.getAttribute('datetime')).toBe(page.items[0]?.occurredAt);
    component['move']('older');
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { action: 'quote.created', limit: 2, cursor: lastId, direction: 'older' },
    });
    component['move']('newer');
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { action: 'quote.created', limit: 2, cursor: firstId, direction: 'newer' },
    });
  });

  it('rejects an invalid URL without requesting audit data', async () => {
    const { fixture, list } = setup({ cursor: 'invalid' });
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(list).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('table')).toBeNull();
    expect(
      [...root.querySelectorAll<HTMLButtonElement>('app-result-navigation button')].every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });

  it('keeps invalid submit enabled, focuses the field, and resets pagination for new filters', async () => {
    const { fixture, component, navigate } = setup({ cursor: firstId, limit: '2' });
    await fixture.whenStable();
    component['filters'].resourceType().value.set('Invalid Type');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('app-filter-menu button')?.click();
    await fixture.whenStable();
    const categories = document.querySelectorAll<HTMLButtonElement>(
      '[role="dialog"] [role="menuitem"]',
    );
    expect(categories).toHaveLength(2);
    expect(document.querySelector('[role="dialog"] input')).toBeNull();
    expect(document.querySelector('[role="dialog"] select')).toBeNull();
    categories[1]?.click();
    await fixture.whenStable();
    const submit = document.querySelector<HTMLButtonElement>(
      '[role="dialog"] button[type="submit"]',
    );
    expect(submit?.disabled).toBe(false);
    submit?.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(document.querySelector('#audit-resource-type'));
    expect(navigate).not.toHaveBeenCalled();
    component['filters'].resourceType().value.set('invoice');
    component['apply'](new SubmitEvent('submit'));
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { action: null, resourceType: 'invoice', limit: 2 },
    });
  });

  it('removes prior rows on errors and shows a separate empty state after recovery', async () => {
    const { fixture, list, queryParamMap } = setup();
    await fixture.whenStable();
    list.mockResolvedValueOnce({ success: false, code: 'authentication.permission_denied' });
    queryParamMap.next(convertToParamMap({ action: 'invoice.created' }));
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('table')).toBeNull();
    expect(root.textContent).not.toContain(lastId);
    list.mockResolvedValueOnce({
      success: true,
      result: { items: [], previousCursor: null, nextCursor: null },
    });
    queryParamMap.next(convertToParamMap({ resourceType: 'client' }));
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    expect(root.querySelector('table')).toBeNull();
  });

  it('clears a server-refused page size when resetting invalid filters', async () => {
    const { fixture, list, queryParamMap, component, navigate } = setup();
    await fixture.whenStable();
    list.mockResolvedValueOnce({ success: false, code: 'audit.invalid_query', status: 400 });
    queryParamMap.next(convertToParamMap({ limit: '75' }));
    await fixture.whenStable();
    expect(list).toHaveBeenLastCalledWith({ limit: 75 });
    expect(component['error']()).toBe('audit.invalid_query');
    expect(component['page']().items).toEqual([]);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('table')).toBeNull();
    component['reset']();
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { limit: null },
    });
    queryParamMap.next(convertToParamMap({}));
    await fixture.whenStable();
    expect(component['state']()).toBe('ready');
    expect(list).toHaveBeenLastCalledWith({});
  });

  it('applies an exact catalog action without submitting the resource draft', async () => {
    const { fixture, component, navigate } = setup({
      resourceType: 'document-revision',
      cursor: firstId,
      limit: '2',
      pageQ: 'created',
      pageSort: 'actionAsc',
    });
    await fixture.whenStable();
    component['filters'].resourceType().value.set('Invalid Draft');
    expect(component['actionOptions']().map(({ value }) => value)).toContain('invoice.created');
    component['setAction']('unknown-action');
    expect(navigate).not.toHaveBeenCalled();
    component['setAction']('invoice.created');
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: {
        action: 'invoice.created',
        resourceType: 'document-revision',
        limit: 2,
        pageQ: 'created',
        pageSort: 'actionAsc',
      },
    });
  });

  it('ignores a stale success after a newer request fails', async () => {
    const { fixture, list, component } = setup();
    await fixture.whenStable();
    let finish: (outcome: Awaited<ReturnType<AuditApi['list']>>) => void = () => undefined;
    const pending = new Promise<Awaited<ReturnType<AuditApi['list']>>>((resolve) => {
      finish = resolve;
    });
    list.mockReturnValueOnce(pending);
    const older = component['load']({ cursor: firstId });
    expect(component['state']()).toBe('loading');
    expect(component['page']().items).toHaveLength(0);
    list.mockResolvedValueOnce({ success: false, code: 'authentication.permission_denied' });
    await component['load']({ resourceType: 'invoice' });
    finish({ success: true, result: page });
    await older;
    expect(component['state']()).toBe('error');
    expect(component['page']().items).toHaveLength(0);
    expect(component['error']()).toBe('authentication.permission_denied');
  });

  it('keeps search and sorting local and preserves the server cursor in page links', async () => {
    const { fixture, list, queryParamMap, component, navigate } = setup({
      action: 'quote.created',
    });
    await fixture.whenStable();
    const initialCalls = list.mock.calls.length;
    queryParamMap.next(
      convertToParamMap({ action: 'quote.created', pageQ: 'quote', pageSort: 'actionAsc' }),
    );
    await fixture.whenStable();
    expect(list).toHaveBeenCalledTimes(initialCalls);
    expect(component['table'].rows()).toEqual(page.items);
    expect(component['auditExport']()[0]).toEqual([
      firstId,
      'quote.created',
      'quote',
      lastId,
      page.items[0]?.occurredAt,
    ]);
    component['move']('older');
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: {
        action: 'quote.created',
        pageQ: 'quote',
        pageSort: 'actionAsc',
        cursor: lastId,
        direction: 'older',
      },
    });
    queryParamMap.next(convertToParamMap({ action: 'quote.created', pageQ: 'no-matching-event' }));
    await fixture.whenStable();
    expect(component['table'].rows()).toHaveLength(0);
    expect(component['auditExport']()).toHaveLength(0);
    expect(component['page']().nextCursor).toBe(lastId);
    expect(list).toHaveBeenCalledTimes(initialCalls);
    component['reset']();
    expect(navigate).toHaveBeenLastCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { pageQ: 'no-matching-event', limit: null },
    });
  });
});
