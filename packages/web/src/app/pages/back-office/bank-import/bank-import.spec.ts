import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BankImport } from './bank-import';
import { DefaultBankCsvConfiguration } from '@froment/contracts';
import {
  bankField,
  bankPreview,
  bankSortHeader,
  bankRoot,
  bankSubmit,
  setupBankWorkspace,
} from '../banking/bank-workspace.spec-helper';

const csv =
  '\uFEFFtransaction_id,booked_on,amount,currency,description\nBANK-1,2026-09-01,100.00,EUR,"Règlement\nclient"';
function chooseFile(
  root: HTMLElement,
  bytes: Uint8Array<ArrayBuffer>,
  read = async () => bytes.buffer,
): void {
  const input = root.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('bank.test.file_missing');
  const file = new File([bytes], 'statement.csv', { type: 'text/csv' });
  Object.defineProperty(file, 'arrayBuffer', { value: read });
  Object.defineProperty(input, 'files', { configurable: true, value: [file] });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
describe('Bank import task', () => {
  it('validates all data before confirmation and reports authoritative import counts', async () => {
    const { api } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking/import', BankImport);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.previewStatement).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('#bank-account'));
    bankField(root, '#bank-account', ' Compte local ');
    chooseFile(root, new TextEncoder().encode(csv));
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.previewStatement).toHaveBeenCalledWith({
      account: 'Compte local',
      format: 'csv',
      csvConfiguration: DefaultBankCsvConfiguration,
      content: csv.slice(1),
    });
    expect(api.importStatement).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Règlement\nclient');
    root.querySelector<HTMLButtonElement>('button[variant="primary"]')?.click();
    await harness.fixture.whenStable();
    expect(api.importStatement).toHaveBeenCalledWith({
      account: 'Compte local',
      format: 'csv',
      csvConfiguration: DefaultBankCsvConfiguration,
      content: csv.slice(1),
    });
    expect(root.textContent).toContain('1 ajoutée(s)');
    expect(root.querySelector('input[type="file"]')).toBeNull();
  });
  it('rejects invalid UTF-8 and preserves the selected file when navigation is refused', async () => {
    const { confirmation, api } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking/import', BankImport);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    chooseFile(root, new Uint8Array([0xff, 0xff]));
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(api.previewStatement).not.toHaveBeenCalled();
    bankField(root, '#bank-account', 'Compte local');
    chooseFile(root, new TextEncoder().encode(csv));
    await harness.fixture.whenStable();
    confirmation.request.mockResolvedValue(false);
    await harness.navigateByUrl('/backoffice/banking');
    expect(TestBed.inject(Router).url).toBe('/backoffice/banking/import');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it('ignores a late file read after another file was selected', async () => {
    const { api } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/backoffice/banking/import', BankImport);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, '#bank-account', 'Compte local');
    let resolveOldRead: ((buffer: ArrayBuffer) => void) | undefined;
    const oldRead = new Promise<ArrayBuffer>((resolve) => {
      resolveOldRead = resolve;
    });
    chooseFile(root, new TextEncoder().encode('old'), () => oldRead);
    chooseFile(root, new TextEncoder().encode(csv));
    await harness.fixture.whenStable();
    if (!resolveOldRead) throw new Error('bank.test.file_resolver_missing');
    resolveOldRead(new TextEncoder().encode('old').buffer);
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.previewStatement).toHaveBeenCalledWith({
      account: 'Compte local',
      format: 'csv',
      csvConfiguration: DefaultBankCsvConfiguration,
      content: csv.slice(1),
    });
  });
  it('sorts the preview without changing its request or the transaction list sort', async () => {
    const { api } = setupBankWorkspace();
    const first = bankPreview.rows[0];
    if (!first) throw new Error('bank.test.preview_missing');
    api.previewStatement.mockResolvedValue({
      success: true,
      result: {
        added: 2,
        existing: 0,
        rows: [first, { ...first, reference: 'BANK-2', bookedOn: '2026-09-02', amountCents: -900 }],
      },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      '/backoffice/banking/import?sort=reference-desc&previewSort=invalid&q=reglement&account=MAIN',
      BankImport,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, '#bank-account', 'MAIN');
    chooseFile(root, new TextEncoder().encode(csv));
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(root.querySelector('tbody th')?.textContent).toContain('BANK-2');
    expect(bankSortHeader(root, 'Date').getAttribute('aria-sort')).toBe('none');
    bankSortHeader(root, 'Montant').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('previewSort=amount-asc');
    expect(TestBed.inject(Router).url).toContain('sort=reference-desc');
    expect(api.previewStatement).toHaveBeenCalledTimes(1);
    expect(root.querySelector('a[pageBack]')?.getAttribute('href')).toContain(
      'sort=reference-desc',
    );
    bankSortHeader(root, 'Montant').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('tbody th')?.textContent).toContain('BANK-1');
    expect(TestBed.inject(Router).url).toContain('previewSort=amount-desc');
    bankSortHeader(root, 'Montant').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
      sort: 'reference-desc',
      q: 'reglement',
      account: 'MAIN',
    });
    expect(bankSortHeader(root, 'Montant').getAttribute('aria-sort')).toBe('none');
    expect(bankSortHeader(root, 'Date').getAttribute('aria-sort')).toBe('none');
    expect(root.querySelector('tbody th')?.textContent).toContain('BANK-2');
    expect(api.previewStatement).toHaveBeenCalledTimes(1);
    root.querySelector<HTMLButtonElement>('.actions button[variant="primary"]')?.click();
    await harness.fixture.whenStable();
    expect(api.importStatement).toHaveBeenCalledWith({
      account: 'MAIN',
      format: 'csv',
      csvConfiguration: DefaultBankCsvConfiguration,
      content: csv.slice(1),
    });
  });
});
