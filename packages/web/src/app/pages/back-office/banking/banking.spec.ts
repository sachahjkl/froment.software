import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { Banking } from './banking';
import {
  bankField,
  bankFilterPanel,
  bankNamedInput,
  bankSubmit,
  bankExport,
  bankSortHeader,
  bankRoot,
  bankTransaction,
  otherBankId,
  setupBankWorkspace,
} from './bank-workspace.spec-helper';

describe('Banking transaction workspace', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    scrolling.restore();
  });
  it('restores URL filters and distinguishes partial credits from debits', async () => {
    const { api } = setupBankWorkspace();
    api.list.mockResolvedValue([
      { ...bankTransaction, matchedCents: 2000 },
      { ...bankTransaction, id: otherBankId, reference: 'DEBIT', amountCents: -1000 },
    ]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking?flow=credit&status=partial&q=reglement',
      Banking,
    );
    await harness.fixture.whenStable();
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(1);
    expect(bankRoot(harness).textContent).toContain('Partiellement rapproché');
    expect(bankRoot(harness).textContent).toContain('1 transaction affichée');
    expect(bankRoot(harness).querySelector('tbody a')?.getAttribute('href')).toContain(
      '/transactions/',
    );
    await harness.navigateByUrl('/backoffice/banking?flow=debit', Banking);
    await harness.fixture.whenStable();
    expect(bankRoot(harness).textContent).toContain('Sans rapprochement');
    expect(bankRoot(harness).textContent).not.toContain('Partiellement rapproché');
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('keeps search in the URL and renders no matches separately from an empty account', async () => {
    setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking', Banking);
    await harness.fixture.whenStable();
    bankField(bankRoot(harness), 'input[type="search"]', 'absent-zzzz');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('q=absent-zzzz');
    expect(bankRoot(harness).textContent).toContain('Aucune transaction ne correspond');
    expect(bankRoot(harness).textContent).toContain('0 transaction affichée');
    expect(bankRoot(harness).querySelector('form')).toBeNull();
    expect(bankRoot(harness).querySelector('input[type="file"]')).toBeNull();
  });
  it('shows a retry action after a load failure', async () => {
    const { api } = setupBankWorkspace();
    api.list.mockRejectedValueOnce(new Error('offline'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking', Banking);
    await harness.fixture.whenStable();
    expect(bankRoot(harness).querySelector('[role="alert"]')).not.toBeNull();
    [...bankRoot(harness).querySelectorAll<HTMLButtonElement>('button[appButton]')]
      .find((button) => button.textContent?.includes('Recharger'))
      ?.click();
    await harness.fixture.whenStable();
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(1);
  });
  it('sorts loaded results, exports only displayed rows and preserves sorting through a transaction', async () => {
    const { api } = setupBankWorkspace();
    api.list.mockResolvedValue([
      { ...bankTransaction, amountCents: 10000, bookedOn: '2026-09-01' },
      {
        ...bankTransaction,
        id: otherBankId,
        reference: 'BANK-2',
        amountCents: -900,
        bookedOn: '2026-09-02',
      },
    ]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking?sort=invalid', Banking);
    await harness.fixture.whenStable();
    expect(bankSortHeader(bankRoot(harness), 'Date').getAttribute('aria-sort')).toBe('none');
    expect(bankRoot(harness).textContent).toContain('2 transactions affichées');
    expect(bankRoot(harness).querySelector('tbody a')?.textContent).toContain('BANK-2');
    const amount = bankSortHeader(bankRoot(harness), 'Montant');
    amount.querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(amount.getAttribute('aria-sort')).toBe('ascending');
    expect(TestBed.inject(Router).url).toContain('sort=amount-asc');
    expect(bankExport(harness).columns()).toContain('amount_cents');
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[6]),
    ).toEqual([-900, 10000]);
    amount.querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[6]),
    ).toEqual([10000, -900]);
    expect(bankRoot(harness).querySelectorAll('[appFilterChip]')).toHaveLength(0);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(bankRoot(harness).querySelector('app-list-search label')?.textContent).toContain(
      'Rechercher un libellé ou une référence',
    );
    bankField(bankRoot(harness), 'app-list-search input', 'reglement');
    await harness.fixture.whenStable();
    bankRoot(harness).querySelector<HTMLAnchorElement>('tbody a')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('sort=amount-desc');
    bankRoot(harness).querySelector<HTMLAnchorElement>('a[pageBack]')!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('sort=amount-desc');
    expect(TestBed.inject(Router).url).toContain('q=reglement');
    expect(bankSortHeader(bankRoot(harness), 'Montant').getAttribute('aria-sort')).toBe(
      'descending',
    );
    bankSortHeader(bankRoot(harness), 'Montant').querySelector('button')?.click();
    await harness.fixture.whenStable();
    const resetParams = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams;
    expect(resetParams['sort']).toBeUndefined();
    expect(resetParams['q']).toBe('reglement');
    expect(bankSortHeader(bankRoot(harness), 'Montant').getAttribute('aria-sort')).toBe('none');
    expect(bankSortHeader(bankRoot(harness), 'Date').getAttribute('aria-sort')).toBe('none');
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[6]),
    ).toEqual([-900, 10000]);
    bankField(bankRoot(harness), 'app-list-search input', 'absent-zzzz');
    await harness.fixture.whenStable();
    expect(
      TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['sort'],
    ).toBeUndefined();
    expect(bankExport(harness).rows()).toEqual([]);
    expect(
      bankRoot(harness).querySelector('app-table-export button')?.getAttribute('aria-disabled'),
    ).toBe('true');
    expect(api.list).toHaveBeenCalledTimes(2);
  });
  it('commits exact searchable account choices in a single panel and cancels uncommitted searches', async () => {
    const { api } = setupBankWorkspace();
    api.list.mockResolvedValue([
      { ...bankTransaction, account: 'MAIN', reference: 'UPPER' },
      { ...bankTransaction, id: otherBankId, account: 'main', reference: 'LOWER' },
    ]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking?sort=amount-desc', Banking);
    await harness.fixture.whenStable();
    const trigger = bankRoot(harness).querySelector<HTMLButtonElement>('app-filter-menu > button');
    if (!trigger) throw new Error('bank.test.filter_trigger_missing');
    trigger.click();
    await harness.fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('bank.test.filter_dialog_missing');
    expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(4);
    expect(dialog.querySelector('input, select, details')).toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
    const dialogId = dialog.id;
    dialog.querySelector<HTMLElement>('[role="menuitem"]')?.click();
    await harness.fixture.whenStable();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.id).toBe(dialogId);
    const search = bankNamedInput(dialog, 'Rechercher une option');
    expect(document.activeElement).toBe(search);
    bankField(dialog, 'input[role="combobox"]', 'missing-account-zzzz');
    await harness.fixture.whenStable();
    expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(dialog.textContent).toContain('Aucune option ne correspond.');
    pressKey(search, 'Enter');
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).not.toContain('account=');
    bankField(dialog, 'input[role="combobox"]', 'mai');
    await harness.fixture.whenStable();
    const options = [...dialog.querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.map((item) => item.textContent?.trim())).toEqual(['MAIN', 'main']);
    options.find((item) => item.textContent?.trim() === 'main')?.click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(TestBed.inject(Router).url).toContain('account=main');
    expect(TestBed.inject(Router).url).toContain('sort=amount-desc');
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(1);
    expect(bankRoot(harness).querySelector('tbody')?.textContent).toContain('LOWER');
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[3]),
    ).toEqual(['main']);
    const selected = await bankFilterPanel(harness, 'Libellé du compte');
    expect(
      selected.querySelector('[role="option"][aria-selected="true"]')?.textContent?.trim(),
    ).toBe('main');
    bankField(selected, 'input[role="combobox"]', 'UPPER');
    await harness.fixture.whenStable();
    pressKey(bankNamedInput(selected, 'Rechercher une option'), 'Escape', 27);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(TestBed.inject(Router).url).toContain('account=main');
    const all = await bankFilterPanel(harness, 'Libellé du compte');
    [...all.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((item) => item.textContent?.trim() === 'Tous les comptes')
      ?.click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['account']).toBe(
      '',
    );
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(2);
    expect(api.list).toHaveBeenCalledTimes(1);
  });
  it('applies and clears date bounds atomically while preserving account, direction and sorting', async () => {
    const { api } = setupBankWorkspace();
    api.list.mockResolvedValue([{ ...bankTransaction, account: 'MAIN' }]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking?account=MAIN&flow=credit&sort=amount-asc',
      Banking,
    );
    await harness.fixture.whenStable();
    const originalUrl = TestBed.inject(Router).url;
    const panel = await bankFilterPanel(harness, 'Période');
    const from = bankNamedInput(panel, 'Début');
    const to = bankNamedInput(panel, 'Fin');
    from.value = '2026-09-03';
    from.dispatchEvent(new Event('input', { bubbles: true }));
    to.value = '2026-09-01';
    to.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(originalUrl);
    bankSubmit(panel);
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(to);
    expect(panel.querySelector('[role="alert"]')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe(originalUrl);
    to.value = '2026-09-04';
    to.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    bankSubmit(panel);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(TestBed.inject(Router).url).toContain('from=2026-09-03');
    expect(TestBed.inject(Router).url).toContain('to=2026-09-04');
    const reopened = await bankFilterPanel(harness, 'Période');
    expect(bankNamedInput(reopened, 'Début').value).toBe('2026-09-03');
    reopened.querySelector<HTMLButtonElement>('form button[type="button"]')?.click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const params = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams;
    expect(params['from']).toBe('');
    expect(params['to']).toBe('');
    expect(params['account']).toBe('MAIN');
    expect(params['flow']).toBe('credit');
    expect(params['sort']).toBe('amount-asc');
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(1);
    const openRange = await bankFilterPanel(harness, 'Période');
    const openFrom = bankNamedInput(openRange, 'Début');
    openFrom.value = '2026-09-01';
    openFrom.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    bankSubmit(openRange);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    const openParams = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams;
    expect(openParams['from']).toBe('2026-09-01');
    expect(openParams['to']).toBe('');
    expect(openParams['account']).toBe('MAIN');
    expect(openParams['sort']).toBe('amount-asc');
    for (const sort of ['amount-desc', undefined]) {
      bankSortHeader(bankRoot(harness), 'Montant').querySelector('button')?.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
        ...openParams,
        sort,
      });
    }
    expect(bankSortHeader(bankRoot(harness), 'Montant').getAttribute('aria-sort')).toBe('none');
    expect(api.list).toHaveBeenCalledTimes(1);
  });
});
