import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { By } from '@angular/platform-browser';
import { TableExport } from '@shared/table-export/table-export';
import {
  type BankImportPreview,
  type BankMatchHistory,
  type BankTransactionValue,
  type LedgerEntry,
  type LedgerSource,
} from '@froment/contracts';
import { BankingApi } from '@backoffice/banking-api';
import { BankLedgerApi } from '@backoffice/bank-ledger-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { I18nService } from '@app/i18n.service';
import { vi } from 'vitest';
import { bankWorkspaceRoutes } from './bank-workspace.routes';

export const bankId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
export const otherBankId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
export const bankTransaction: BankTransactionValue = {
  id: bankId,
  account: 'Compte local',
  reference: 'BANK-1',
  bookedOn: '2026-09-01',
  amountCents: 10000,
  description: 'Règlement client',
  importedAt: '2026-09-01T12:00:00.000Z',
  matchedCents: 0,
  allocations: [],
};
export const ledgerSource: typeof LedgerSource.Type = {
  sourceKind: 'debit',
  sourceId: bankId,
  reference: 'DEBIT-1',
  account: 'Compte local',
  bookedOn: '2026-09-01',
  amountCents: 1234,
  entryId: null,
};
export const ledgerEntry: typeof LedgerEntry.Type = {
  id: otherBankId,
  requestId: '3ee3ca5a-17c2-49a4-bdf8-48e003e2f984',
  sourceKind: 'debit',
  sourceId: bankId,
  debitAccount: '627',
  creditAccount: '512',
  label: 'Frais septembre',
  amountCents: 1234,
  bookedOn: '2026-09-01',
  recordedAt: '2026-09-01T12:00:00.000Z',
  recordedByUserId: bankId,
  reversesId: null,
  reversalId: null,
};
export const bankHistory: typeof BankMatchHistory.Type = [
  {
    id: bankId,
    paymentId: bankId,
    invoiceId: bankId,
    invoiceNumber: 'FA-2026-000001',
    amountCents: 10000,
    feeCents: 0,
    matchedAt: bankTransaction.importedAt,
    matchedByUserId: bankId,
    cancelledAt: bankTransaction.importedAt,
    cancelledByUserId: bankId,
    cancellationReason: '<script>Erreur de rapprochement</script>',
  },
];
export const bankPreview: typeof BankImportPreview.Type = {
  added: 1,
  existing: 0,
  rows: [
    {
      reference: 'BANK-1',
      bookedOn: '2026-09-01',
      amountCents: 10000,
      description: 'Règlement\nclient',
      existing: false,
    },
  ],
};
export function setupBankWorkspace() {
  const api = {
    list: vi.fn<BankingApi['list']>(async () => [bankTransaction]),
    get: vi.fn<BankingApi['get']>(async () => ({ success: true, result: bankTransaction })),
    history: vi.fn<BankingApi['history']>(async () => ({ success: true, result: bankHistory })),
    payments: vi.fn<BankingApi['payments']>(async () => ({
      success: true,
      result: [
        {
          id: bankId,
          amountCents: 20000,
          availableCents: 20000,
          paidOn: '2026-09-01',
          reference: 'RECEIPT-1',
        },
      ],
    })),
    match: vi.fn<BankingApi['match']>(async () => ({ success: false, code: 'bank.error' })),
    unmatch: vi.fn<BankingApi['unmatch']>(async () => ({
      success: true,
      result: [bankTransaction],
    })),
    previewStatement: vi.fn<BankingApi['previewStatement']>(async () => ({
      success: true,
      result: bankPreview,
    })),
    importStatement: vi.fn<BankingApi['importStatement']>(async () => ({
      success: true,
      result: { added: 1, existing: 0 },
    })),
  };
  const ledger = {
    list: vi.fn<BankLedgerApi['list']>(async () => ({
      success: true,
      result: {
        sources: [ledgerSource],
        entries: [{ ...ledgerEntry, sourceReference: 'DEBIT-1' }],
      },
    })),
    getSource: vi.fn<BankLedgerApi['getSource']>(async () => ({
      success: true,
      result: { source: ledgerSource, transactionId: bankId },
    })),
    getEntry: vi.fn<BankLedgerApi['getEntry']>(async () => ({
      success: true,
      result: ledgerEntry,
    })),
    post: vi.fn<BankLedgerApi['post']>(async () => ({ success: false, code: 'ledger.error' })),
    reverse: vi.fn<BankLedgerApi['reverse']>(async () => ({
      success: false,
      code: 'ledger.error',
    })),
  };
  const confirmation = { request: vi.fn(async (_message: string) => true) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter(bankWorkspaceRoutes.map((route) => ({ ...route, canActivate: [] }))),
      { provide: BankingApi, useValue: api },
      { provide: BankLedgerApi, useValue: ledger },
      {
        provide: InvoicesApi,
        useValue: {
          list: async () => [
            { id: bankId, invoiceNumber: 'FA-2026-000001', status: 'issued', title: 'Prestation' },
            {
              id: otherBankId,
              invoiceNumber: 'FA-2026-000002',
              status: 'paid',
              title: 'Autre prestation',
            },
          ],
        },
      },
      { provide: Confirmation, useValue: confirmation },
    ],
  });
  TestBed.inject(I18nService).setLanguage('fr');
  return { api, ledger, confirmation };
}
export function bankRoot(harness: RouterTestingHarness): HTMLElement {
  const element = harness.routeNativeElement;
  if (!element) throw new Error('bank.test.page_missing');
  return element;
}
export function bankField(root: HTMLElement, selector: string, value: string): void {
  const input = root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    selector,
  );
  if (!input) throw new Error(`bank.test.field_missing: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
export function bankSubmit(root: HTMLElement, selector = 'form'): void {
  const form = root.querySelector(selector);
  if (!form) throw new Error('bank.test.form_missing');
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
}
export function bankSortHeader(root: HTMLElement, label: string): HTMLTableCellElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button[appTableSort]')].find(
    (item) => item.querySelector('span')?.textContent?.trim() === label,
  );
  const header = button?.closest('th');
  if (!header) throw new Error(`bank.test.sort_missing: ${label}`);
  return header;
}
export function bankExport(harness: RouterTestingHarness): TableExport {
  const component = harness.routeDebugElement
    ?.query(By.directive(TableExport))
    .injector.get(TableExport);
  if (!component) throw new Error('bank.test.export_missing');
  return component;
}
export async function bankFilterPanel(
  harness: RouterTestingHarness,
  label: string,
): Promise<HTMLElement> {
  const trigger = bankRoot(harness).querySelector<HTMLButtonElement>('app-filter-menu > button');
  if (!trigger) throw new Error('bank.test.filter_trigger_missing');
  trigger.click();
  await harness.fixture.whenStable();
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  const category = [...(dialog?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].find(
    (item) => item.textContent?.trim().startsWith(label),
  );
  if (!dialog || !category) throw new Error(`bank.test.filter_panel_missing: ${label}`);
  category.click();
  await harness.fixture.whenStable();
  return dialog;
}
export function bankNamedInput(root: HTMLElement, label: string): HTMLInputElement {
  const input = [...root.querySelectorAll('input')].find(
    (item) =>
      item.getAttribute('aria-label') === label ||
      [...(item.labels ?? [])].some((element) => element.textContent?.trim() === label),
  );
  if (!input) throw new Error(`bank.test.input_missing: ${label}`);
  return input;
}
