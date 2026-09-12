import { provideAccount } from '@backoffice/account.spec-helper';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { BankLedger } from './bank-ledger';
import {
  bankRoot,
  bankExport,
  bankField,
  bankFilterPanel,
  bankNamedInput,
  bankSubmit,
  bankSortHeader,
  ledgerEntry,
  ledgerSource,
  otherBankId,
  setupBankWorkspace,
} from '../banking/bank-workspace.spec-helper';

describe('Bank ledger workspace', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('searches preserved bank references even when a source is no longer available to post', async () => {
    const { ledger } = setupBankWorkspace();
    ledger.list.mockResolvedValue({
      success: true,
      result: {
        sources: [],
        entries: [{ ...ledgerEntry, sourceReference: 'REFERENCE-CONSERVEE' }],
      },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?from=2026-09-01&to=2026-09-30&view=journal&q=REFERENCE-CONSERVEE',
      BankLedger,
    );
    await harness.fixture.whenStable();
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(1);
    expect(bankRoot(harness).querySelector('tbody')?.textContent).toContain('REFERENCE-CONSERVEE');
    expect(bankRoot(harness).textContent).toContain('1 élément affiché');
  });
  it('lists only unposted sources and opens dedicated posting tasks', async () => {
    const { ledger } = setupBankWorkspace();
    ledger.list.mockResolvedValue({
      success: true,
      result: {
        entries: [],
        sources: [ledgerSource, { ...ledgerSource, sourceId: otherBankId, entryId: otherBankId }],
      },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?from=2026-09-01&to=2026-09-30',
      BankLedger,
    );
    await harness.fixture.whenStable();
    expect(ledger.list).toHaveBeenCalledWith({ from: '2026-09-01', to: '2026-09-30' });
    expect(bankRoot(harness).querySelectorAll('tbody tr')).toHaveLength(1);
    expect(bankRoot(harness).querySelector('tbody a')?.getAttribute('href')).toContain(
      '/post/debit/',
    );
    expect(bankRoot(harness).querySelector('textarea')).toBeNull();
  });
  it('restores the journal view without loading the same period twice', async () => {
    const { ledger } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?from=2026-09-01&to=2026-09-30',
      BankLedger,
    );
    await harness.fixture.whenStable();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?from=2026-09-01&to=2026-09-30&view=journal',
      BankLedger,
    );
    await harness.fixture.whenStable();
    expect(ledger.list).toHaveBeenCalledTimes(1);
    expect(bankRoot(harness).querySelector('tbody a')?.textContent).toContain('Frais septembre');
    expect(bankRoot(harness).querySelector('a[download]')?.getAttribute('href')).toBe(
      '/api/banking/ledger/export?from=2026-09-01&to=2026-09-30',
    );
    expect(bankRoot(harness).textContent).toContain('ni un FEC');
  });
  it('sorts source kinds and cents, exports sorted sources and preserves sorting through posting', async () => {
    const { ledger } = setupBankWorkspace();
    ledger.list.mockResolvedValue({
      success: true,
      result: {
        entries: [],
        sources: [
          { ...ledgerSource, amountCents: 10000 },
          {
            ...ledgerSource,
            sourceId: otherBankId,
            sourceKind: 'fee',
            amountCents: 900,
            reference: 'FEES',
            bookedOn: '2026-09-02',
          },
        ],
      },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?from=2026-09-01&to=2026-09-30',
      BankLedger,
    );
    await harness.fixture.whenStable();
    expect(bankRoot(harness).querySelector('tbody a')?.textContent).toContain('FEES');
    expect(bankSortHeader(bankRoot(harness), 'Date').getAttribute('aria-sort')).toBe('none');
    expect(bankRoot(harness).textContent).toContain('2 éléments affichés');
    bankSortHeader(bankRoot(harness), 'Type de source').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(bankRoot(harness).querySelector('tbody a')?.textContent).toContain('DEBIT-1');
    const amount = bankSortHeader(bankRoot(harness), 'Montant');
    amount.querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[5]),
    ).toEqual([900, 10000]);
    amount.querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[5]),
    ).toEqual([10000, 900]);
    expect(bankExport(harness).filename()).toBe('bank-source-results.csv');
    expect(ledger.list).toHaveBeenCalledTimes(1);
    bankRoot(harness).querySelector<HTMLAnchorElement>('tbody a')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/post/debit/');
    expect(TestBed.inject(Router).url).toContain('sort=amount-desc');
    bankRoot(harness).querySelector<HTMLAnchorElement>('a[pageBack]')!.click();
    await harness.fixture.whenStable();
    expect(bankSortHeader(bankRoot(harness), 'Montant').getAttribute('aria-sort')).toBe(
      'descending',
    );
    expect(TestBed.inject(Router).url).toContain('sort=amount-desc');
    bankSortHeader(bankRoot(harness), 'Montant').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(
      TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['sort'],
    ).toBeUndefined();
    expect(bankSortHeader(bankRoot(harness), 'Montant').getAttribute('aria-sort')).toBe('none');
    expect(bankSortHeader(bankRoot(harness), 'Date').getAttribute('aria-sort')).toBe('none');
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[5]),
    ).toEqual([900, 10000]);
    expect(ledger.list).toHaveBeenCalledTimes(2);
  });
  it('keeps the period export separate from displayed journal rows and restores sorting after a reversal detail', async () => {
    const { ledger } = setupBankWorkspace();
    ledger.list.mockResolvedValue({
      success: true,
      result: {
        sources: [],
        entries: [
          { ...ledgerEntry, sourceReference: 'BANK-2', label: 'Écriture 2', amountCents: 900 },
          {
            ...ledgerEntry,
            id: ledgerSource.sourceId,
            sourceReference: 'BANK-10',
            label: 'Écriture 10',
            amountCents: 10000,
            bookedOn: '2026-09-02',
          },
        ],
      },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?view=journal&from=2026-09-01&to=2026-09-30&sort=reference-asc',
      BankLedger,
    );
    await harness.fixture.whenStable();
    expect(
      bankExport(harness)
        .rows()
        .map((row) => row[2]),
    ).toEqual(['BANK-2', 'BANK-10']);
    expect(bankRoot(harness).querySelectorAll('thead button[appTableSort]')).toHaveLength(7);
    bankRoot(harness).querySelector<HTMLAnchorElement>('tbody a')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('/reverse');
    expect(TestBed.inject(Router).url).toContain('sort=reference-asc');
    bankRoot(harness).querySelector<HTMLAnchorElement>('a[pageBack]')!.click();
    await harness.fixture.whenStable();
    expect(bankSortHeader(bankRoot(harness), 'Référence').getAttribute('aria-sort')).toBe(
      'ascending',
    );
    bankSortHeader(bankRoot(harness), 'Référence').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('sort=reference-desc');
    bankSortHeader(bankRoot(harness), 'Référence').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
      view: 'journal',
      from: '2026-09-01',
      to: '2026-09-30',
      q: '',
    });
    expect(bankSortHeader(bankRoot(harness), 'Référence').getAttribute('aria-sort')).toBe('none');
    expect(bankSortHeader(bankRoot(harness), 'Date').getAttribute('aria-sort')).toBe('none');
    const localExport = bankExport(harness);
    expect(localExport.filename()).toBe('bank-journal-results.csv');
    expect(localExport.rows().map((row) => row[2])).toEqual(['BANK-10', 'BANK-2']);
    bankField(bankRoot(harness), 'app-list-search input', 'absent-zzzz');
    await harness.fixture.whenStable();
    expect(
      TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams['sort'],
    ).toBeUndefined();
    expect(localExport.rows()).toEqual([]);
    expect(bankRoot(harness).textContent).toContain('0 élément affiché');
    const periodExport = bankRoot(harness).querySelector('a[download]');
    expect(periodExport?.getAttribute('href')).toBe(
      '/api/banking/ledger/export?from=2026-09-01&to=2026-09-30',
    );
    expect(periodExport?.textContent).toContain('Journal de la période (CSV)');
    const hintId = periodExport?.getAttribute('aria-describedby');
    expect(hintId ? document.getElementById(hintId)?.textContent : '').toContain('Export serveur');
    expect(ledger.list).toHaveBeenCalledTimes(2);
  });
  it('keeps the applied server period when a date is missing and preserves the rejected draft', async () => {
    const { ledger } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/ledger?view=journal&from=2026-09-01&to=2026-09-30&q=DEBIT-1&sort=reference-asc',
      BankLedger,
    );
    await harness.fixture.whenStable();
    const originalUrl = TestBed.inject(Router).url;
    const originalExport = bankRoot(harness).querySelector('a[download]')?.getAttribute('href');
    const panel = await bankFilterPanel(harness, 'Période');
    const from = bankNamedInput(panel, 'Début');
    const to = bankNamedInput(panel, 'Fin');
    expect(from.value).toBe('2026-09-01');
    expect(to.value).toBe('2026-09-30');
    to.value = '';
    to.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    bankSubmit(panel);
    await harness.fixture.whenStable();
    expect(panel.querySelector('[role="alert"]')?.textContent).toContain(
      'Saisissez les deux dates',
    );
    expect(document.activeElement).toBe(panel.querySelector('[role="alert"]'));
    expect(from.value).toBe('2026-09-01');
    expect(to.value).toBe('');
    expect(TestBed.inject(Router).url).toBe(originalUrl);
    expect(bankRoot(harness).querySelector('a[download]')?.getAttribute('href')).toBe(
      originalExport,
    );
    expect(ledger.list).toHaveBeenCalledTimes(1);
    to.focus();
    to.value = '2026-09-20';
    to.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    bankSubmit(panel);
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(ledger.list).toHaveBeenLastCalledWith({ from: '2026-09-01', to: '2026-09-20' });
    expect(TestBed.inject(Router).url).toContain('q=DEBIT-1');
    expect(TestBed.inject(Router).url).toContain('sort=reference-asc');
    expect(TestBed.inject(Router).url).toContain('view=journal');
    expect(bankRoot(harness).querySelector('a[download]')?.getAttribute('href')).toBe(
      '/api/banking/ledger/export?from=2026-09-01&to=2026-09-20',
    );
    const reopened = await bankFilterPanel(harness, 'Période');
    reopened.querySelector<HTMLButtonElement>('form button[type="button"]')?.click();
    await harness.fixture.whenStable();
    expect(bankNamedInput(reopened, 'Début').value).toBe('');
    expect(bankNamedInput(reopened, 'Fin').value).toBe('');
    expect(ledger.list).toHaveBeenCalledTimes(2);
    const error = reopened.querySelector<HTMLElement>('[role="alert"]');
    if (!error) throw new Error('bank.test.period_error_missing');
    pressKey(error, 'Escape', 27);
    await harness.fixture.whenStable();
    const restored = await bankFilterPanel(harness, 'Période');
    expect(bankNamedInput(restored, 'Début').value).toBe('2026-09-01');
    expect(bankNamedInput(restored, 'Fin').value).toBe('2026-09-20');
    expect(restored.querySelector('[role="alert"]')).toBeNull();
    pressKey(bankNamedInput(restored, 'Fin'), 'Escape', 27);
    await harness.fixture.whenStable();
    const beforeReset = TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams;
    for (const sort of ['reference-desc', undefined]) {
      bankSortHeader(bankRoot(harness), 'Référence').querySelector('button')?.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
        ...beforeReset,
        sort,
      });
    }
    expect(bankSortHeader(bankRoot(harness), 'Référence').getAttribute('aria-sort')).toBe('none');
    expect(ledger.list).toHaveBeenCalledTimes(2);
  });
});
