import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  type AccountingAccount,
  type AccountingBalanceReport,
  type AccountingEntry,
  type AccountingEvidence,
  type AccountingFinancialReport,
  type AccountingJournal,
  type AccountingLedgerReport,
  type AccountingLetterableLine,
  type AccountingPeriod,
  type AccountingTaxReport,
  type AccountingTaxFilingSettings,
  type AccountingTaxFilingSubmission,
  type OpeningBalancePreview,
} from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { AccountingApi } from '@backoffice/accounting-api';
import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Tabs } from '@shared/tabs/tabs';

const CENTS_PER_UNIT = 100;
const DEFAULT_OPENING_DELIMITER = ';' as const;
type AccountingTab =
  | 'accounts'
  | 'journals'
  | 'periods'
  | 'entries'
  | 'lettering'
  | 'reports'
  | 'opening'
  | 'evidence';
const accountingTabs: ReadonlyArray<AccountingTab> = [
  'accounts',
  'journals',
  'periods',
  'entries',
  'lettering',
  'reports',
  'opening',
  'evidence',
];
interface EntryLineDraft {
  accountId: string;
  label: string;
  debit: string;
  credit: string;
}
interface AccountForm {
  id: string | null;
  code: string;
  label: string;
  kind: AccountingAccount['kind'];
  archived: boolean;
  version: number | null;
}
interface JournalForm {
  id: string | null;
  code: string;
  label: string;
  kind: AccountingJournal['kind'];
  archived: boolean;
  version: number | null;
}
interface EntryForm {
  journalId: string;
  periodId: string;
  entryDate: string;
  reference: string;
  description: string;
  lines: Array<EntryLineDraft>;
}
interface TaxFilingForm {
  adapter: 'local' | 'http';
  endpoint: string;
  apiKey: string;
}
interface OpeningForm {
  csv: string;
  delimiter: ',' | ';' | '\t';
  accountCode: string;
  accountLabel: string;
  debit: string;
  credit: string;
  entryDate: string;
  journalId: string;
  periodId: string;
}
const emptyLine = (): EntryLineDraft => ({ accountId: '', label: '', debit: '', credit: '' });
const today = () => new Date().toISOString().slice(0, 10);
const yearRange = () => {
  const year = new Date().getFullYear();
  return { startsOn: `${year}-01-01`, endsOn: `${year}-12-31` };
};

@Component({
  selector: 'app-accounting',
  host: { class: 'page-container' },
  imports: [Button, Can, DataTable, FormsModule, Notice, PageHeader, Tabs],
  templateUrl: './accounting.html',
  styleUrl: './accounting.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Accounting {
  protected readonly authentication = inject(Authentication);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(AccountingApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly taxEnabled = computed(
    () => this.authentication.account()?.enabledModules.includes('tax') === true,
  );
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busy = signal(false);
  protected readonly notice = signal<TranslationKey | null>(null);
  protected readonly error = signal<TranslationKey | null>(null);
  protected readonly tab = signal<AccountingTab>('accounts');
  protected readonly tabs = computed(() =>
    accountingTabs.map((id) => ({
      id,
      label: this.i18n.t(this.tabLabel(id)),
      active: this.tab() === id,
    })),
  );
  protected readonly accounts = signal<ReadonlyArray<AccountingAccount>>([]);
  protected readonly journals = signal<ReadonlyArray<AccountingJournal>>([]);
  protected readonly periods = signal<ReadonlyArray<AccountingPeriod>>([]);
  protected readonly entries = signal<ReadonlyArray<AccountingEntry>>([]);
  protected readonly letterableLines = signal<ReadonlyArray<AccountingLetterableLine>>([]);
  protected readonly selectedLetteringLines = signal<ReadonlySet<string>>(new Set());
  protected readonly evidence = signal<ReadonlyArray<AccountingEvidence>>([]);
  protected readonly activeAccounts = computed(() =>
    this.accounts().filter((account) => !account.archived),
  );
  protected accountForm: AccountForm = {
    id: null,
    code: '',
    label: '',
    kind: 'asset',
    archived: false,
    version: null,
  };
  protected journalForm: JournalForm = {
    id: null,
    code: '',
    label: '',
    kind: 'general',
    archived: false,
    version: null,
  };
  protected periodForm = { label: '', startsOn: yearRange().startsOn, endsOn: yearRange().endsOn };
  protected entryForm: EntryForm = {
    journalId: '',
    periodId: '',
    entryDate: today(),
    reference: '',
    description: '',
    lines: [emptyLine(), emptyLine()],
  };
  protected reportForm = yearRange();
  protected readonly report = signal<AccountingBalanceReport | null>(null);
  protected readonly ledgerReport = signal<AccountingLedgerReport | null>(null);
  protected readonly financialReport = signal<AccountingFinancialReport | null>(null);
  protected readonly taxReport = signal<AccountingTaxReport | null>(null);
  protected readonly taxFilingSettings = signal<AccountingTaxFilingSettings | null>(null);
  protected readonly taxFilings = signal<ReadonlyArray<AccountingTaxFilingSubmission>>([]);
  protected taxFilingForm: TaxFilingForm = {
    adapter: 'local',
    endpoint: '',
    apiKey: '',
  };
  protected openingForm: OpeningForm = {
    csv: '',
    delimiter: DEFAULT_OPENING_DELIMITER,
    accountCode: 'account',
    accountLabel: 'label',
    debit: 'debit',
    credit: 'credit',
    entryDate: today(),
    journalId: '',
    periodId: '',
  };
  protected readonly openingPreview = signal<OpeningBalancePreview | null>(null);
  protected evidenceForm = { entryId: '', fileName: '', mediaType: '', contentBase64: '' };

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    const [accounts, journals, periods, entries, letterableLines, evidence] = await Promise.all([
      this.api.listAccounts(),
      this.api.listJournals(),
      this.api.listPeriods(),
      this.api.listEntries(),
      this.api.listLetterableLines(),
      this.api.listEvidence(),
    ]);
    if (
      !accounts.success ||
      !journals.success ||
      !periods.success ||
      !entries.success ||
      !letterableLines.success ||
      !evidence.success
    ) {
      this.state.set('error');
      return;
    }
    this.accounts.set(accounts.result);
    this.journals.set(journals.result);
    this.periods.set(periods.result);
    this.entries.set(entries.result);
    this.letterableLines.set(letterableLines.result);
    this.evidence.set(evidence.result);
    this.state.set('ready');
  }

  protected selectTab(tabId: string): void {
    const tab = this.tabs().find(({ id }) => id === tabId)?.id;
    if (tab === undefined) return;
    this.tab.set(tab);
    this.clearMessages();
  }
  protected tabLabel(tab: AccountingTab): TranslationKey {
    return `accounting.${tab}`;
  }
  protected accountHeading(): TranslationKey {
    if (this.accountForm.id) return 'accounting.account.edit';
    return 'accounting.account.add';
  }
  protected journalHeading(): TranslationKey {
    if (this.journalForm.id) return 'accounting.journal.edit';
    return 'accounting.journal.add';
  }
  protected entityStatusLabel(archived: boolean): TranslationKey {
    if (archived) return 'accounting.archived';
    return 'accounting.active';
  }
  protected archiveActionLabel(archived: boolean): TranslationKey {
    if (archived) return 'accounting.reactivate';
    return 'accounting.archive';
  }
  protected openingStatusLabel(balanced: boolean): TranslationKey {
    if (balanced) return 'accounting.opening.balanced';
    return 'accounting.opening.unbalanced';
  }
  protected taxBoxLabel(code: string): TranslationKey {
    if (code === '16') return 'accounting.ca3.box16';
    if (code === '20') return 'accounting.ca3.box20';
    return 'accounting.ca3.box28';
  }
  protected accountKindLabel(kind: AccountingAccount['kind']): TranslationKey {
    return `accounting.accountKind.${kind}`;
  }
  protected journalKindLabel(kind: AccountingJournal['kind']): TranslationKey {
    return `accounting.journalKind.${kind}`;
  }
  protected periodStatusLabel(period: AccountingPeriod): TranslationKey {
    if (period.finalClosed) return 'accounting.period.final';
    return `accounting.period.${period.status}`;
  }
  protected entryStatusLabel(entry: AccountingEntry): TranslationKey {
    return `accounting.entry.${entry.status}`;
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }

  protected editAccount(account: AccountingAccount): void {
    this.accountForm = {
      id: account.id,
      code: account.code,
      label: account.label,
      kind: account.kind,
      archived: account.archived,
      version: account.version,
    };
  }
  protected resetAccount(): void {
    this.accountForm = {
      id: null,
      code: '',
      label: '',
      kind: 'asset',
      archived: false,
      version: null,
    };
  }
  protected async saveAccount(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.writeAccount(this.accountForm.id, {
        code: this.accountForm.code,
        label: this.accountForm.label,
        kind: this.accountForm.kind,
        archived: this.accountForm.archived,
        expectedVersion: this.accountForm.version,
      });
      if (!result.success) return false;
      this.replace(this.accounts, result.result);
      this.resetAccount();
      return true;
    });
  }
  protected async toggleAccount(account: AccountingAccount): Promise<void> {
    await this.run(async () => {
      const result = await this.api.writeAccount(account.id, {
        code: account.code,
        label: account.label,
        kind: account.kind,
        archived: !account.archived,
        expectedVersion: account.version,
      });
      if (!result.success) return false;
      this.replace(this.accounts, result.result);
      return true;
    });
  }

  protected editJournal(journal: AccountingJournal): void {
    this.journalForm = {
      id: journal.id,
      code: journal.code,
      label: journal.label,
      kind: journal.kind,
      archived: journal.archived,
      version: journal.version,
    };
  }
  protected resetJournal(): void {
    this.journalForm = {
      id: null,
      code: '',
      label: '',
      kind: 'general',
      archived: false,
      version: null,
    };
  }
  protected async saveJournal(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.writeJournal(this.journalForm.id, {
        code: this.journalForm.code,
        label: this.journalForm.label,
        kind: this.journalForm.kind,
        archived: this.journalForm.archived,
        expectedVersion: this.journalForm.version,
      });
      if (!result.success) return false;
      this.replace(this.journals, result.result);
      this.resetJournal();
      return true;
    });
  }
  protected async toggleJournal(journal: AccountingJournal): Promise<void> {
    await this.run(async () => {
      const result = await this.api.writeJournal(journal.id, {
        code: journal.code,
        label: journal.label,
        kind: journal.kind,
        archived: !journal.archived,
        expectedVersion: journal.version,
      });
      if (!result.success) return false;
      this.replace(this.journals, result.result);
      return true;
    });
  }

  protected async createPeriod(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.createPeriod(this.periodForm);
      if (!result.success) return false;
      this.periods.update((periods) => [result.result, ...periods]);
      return true;
    });
  }
  protected async transitionPeriod(
    period: AccountingPeriod,
    action: 'lock' | 'close' | 'reopen' | 'final-close',
  ): Promise<void> {
    await this.run(async () => {
      const result = await this.api.transitionPeriod(period.id, action, period.version);
      if (!result.success) return false;
      this.replace(this.periods, result.result);
      return true;
    });
  }

  protected addEntryLine(): void {
    this.entryForm.lines.push(emptyLine());
  }
  protected removeEntryLine(index: number): void {
    if (this.entryForm.lines.length > 2) this.entryForm.lines.splice(index, 1);
  }
  protected async createEntry(): Promise<void> {
    await this.run(async () => {
      const lines = this.entryForm.lines.map((line) => ({
        accountId: line.accountId,
        label: line.label,
        debitCents: this.cents(line.debit),
        creditCents: this.cents(line.credit),
      }));
      const result = await this.api.createEntry({
        requestId: crypto.randomUUID(),
        journalId: this.entryForm.journalId,
        periodId: this.entryForm.periodId,
        entryDate: this.entryForm.entryDate,
        reference: this.entryForm.reference,
        description: this.entryForm.description,
        lines,
      });
      if (!result.success) return false;
      this.entries.update((entries) => [result.result, ...entries]);
      return true;
    });
  }
  protected async commandEntry(entry: AccountingEntry, action: 'post' | 'reverse'): Promise<void> {
    await this.run(async () => {
      const result = await this.api.commandEntry(entry.id, action, {
        requestId: crypto.randomUUID(),
        expectedVersion: entry.version,
      });
      if (!result.success) return false;
      if (action === 'reverse') {
        this.entries.update((entries) => [
          result.result,
          ...entries.map((item) => {
            if (item.id !== entry.id) return item;
            return { ...item, status: 'reversed' as const, version: item.version + 1 };
          }),
        ]);
      } else {
        this.replace(this.entries, result.result);
      }
      return true;
    });
  }

  protected letteringSelected(lineId: string): boolean {
    return this.selectedLetteringLines().has(lineId);
  }
  protected toggleLetteringLine(lineId: string, selected: boolean): void {
    this.selectedLetteringLines.update((current) => {
      const next = new Set(current);
      if (selected) next.add(lineId);
      else next.delete(lineId);
      return next;
    });
  }
  protected async createLettering(): Promise<void> {
    await this.run(async () => {
      const lineIds = [...this.selectedLetteringLines()];
      const result = await this.api.createLettering({ requestId: crypto.randomUUID(), lineIds });
      if (!result.success) return false;
      const selected = new Set(result.result.lineIds);
      this.letterableLines.update((lines) =>
        lines.map((line) => {
          if (!selected.has(line.lineId)) return line;
          return { ...line, letteringCode: result.result.code };
        }),
      );
      this.selectedLetteringLines.set(new Set());
      return true;
    });
  }

  protected async loadReport(): Promise<void> {
    await this.run(async () => {
      const [balance, ledger, financial] = await Promise.all([
        this.api.report(this.reportForm),
        this.api.ledger(this.reportForm),
        this.api.financial(this.reportForm),
      ]);
      if (!balance.success || !ledger.success || !financial.success) return false;
      this.report.set(balance.result);
      this.ledgerReport.set(ledger.result);
      this.financialReport.set(financial.result);
      if (this.taxEnabled()) {
        const tax = await this.api.tax(this.reportForm);
        if (!tax.success) return false;
        this.taxReport.set(tax.result);
      } else {
        this.taxReport.set(null);
      }
      return true;
    });
  }
  protected async downloadFec(): Promise<void> {
    await this.run(async () => {
      const fec = await this.api.fec(this.reportForm);
      this.download(fec, 'fec.txt', 'text/plain;charset=utf-8');
      return true;
    });
  }
  protected async downloadCa3(): Promise<void> {
    await this.run(async () => {
      const ca3 = await this.api.ca3(this.reportForm);
      this.download(ca3, 'ca3.json', 'application/json;charset=utf-8');
      return true;
    });
  }
  protected async loadTaxFiling(): Promise<void> {
    const [settings, submissions] = await Promise.all([
      this.api.taxFilingSettings(),
      this.api.taxFilings(),
    ]);
    if (!settings.success || !submissions.success) {
      this.error.set('accounting.error');
      return;
    }
    this.taxFilingSettings.set(settings.result);
    this.taxFilings.set(submissions.result);
    this.taxFilingForm.adapter = settings.result.adapter;
    this.taxFilingForm.endpoint = settings.result.endpoint ?? '';
  }
  protected async saveTaxFilingSettings(): Promise<void> {
    this.busy.set(true);
    const result = await this.api.updateTaxFilingSettings({
      adapter: this.taxFilingForm.adapter,
      endpoint: this.taxFilingForm.adapter === 'http' ? this.taxFilingForm.endpoint : null,
      apiKey: this.taxFilingForm.apiKey || null,
    });
    this.busy.set(false);
    if (!result.success) {
      this.error.set('accounting.error');
      return;
    }
    this.taxFilingSettings.set(result.result);
    this.taxFilingForm.apiKey = '';
  }
  protected async submitTaxFiling(): Promise<void> {
    const confirmed = await this.confirmation.request(this.i18n.t('accounting.taxFiling.confirm'));
    if (!confirmed) return;
    this.busy.set(true);
    const result = await this.api.submitTaxFiling(this.reportForm);
    this.busy.set(false);
    if (!result.success) {
      this.error.set('accounting.error');
      return;
    }
    this.taxFilings.update((items) => [result.result, ...items]);
    this.notice.set('accounting.taxFiling.submitted');
  }

  protected async readOpeningFile(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.[0];
    if (!file) return;
    this.openingForm.csv = await file.text();
    this.openingPreview.set(null);
  }
  protected async previewOpening(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.previewOpening(this.openingRequest());
      if (!result.success) return false;
      this.openingPreview.set(result.result);
      return true;
    });
  }
  protected async commitOpening(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.commitOpening({
        ...this.openingRequest(),
        requestId: crypto.randomUUID(),
        journalId: this.openingForm.journalId,
        periodId: this.openingForm.periodId,
      });
      if (!result.success) return false;
      this.entries.update((entries) => [result.result, ...entries]);
      return true;
    });
  }

  protected async readEvidenceFile(event: Event): Promise<void> {
    if (!(event.target instanceof HTMLInputElement)) return;
    const file = event.target.files?.[0];
    if (!file) return;
    this.evidenceForm.fileName = file.name;
    this.evidenceForm.mediaType = file.type || 'application/octet-stream';
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    this.evidenceForm.contentBase64 = btoa(binary);
  }
  protected async addEvidence(): Promise<void> {
    await this.run(async () => {
      const result = await this.api.createEvidence(this.evidenceForm);
      if (!result.success) return false;
      this.evidence.update((items) => [result.result, ...items]);
      return true;
    });
  }
  protected async downloadEvidence(item: AccountingEvidence): Promise<void> {
    this.busy.set(true);
    this.clearMessages();
    try {
      const content = await this.api.downloadEvidence(item.id);
      this.downloadBlob(content, item.fileName);
    } catch {
      this.error.set('accounting.error');
    } finally {
      this.busy.set(false);
    }
  }

  private openingRequest() {
    return {
      csv: this.openingForm.csv,
      delimiter: this.openingForm.delimiter,
      columns: {
        accountCode: this.openingForm.accountCode,
        accountLabel: this.openingForm.accountLabel,
        debit: this.openingForm.debit,
        credit: this.openingForm.credit,
      },
      entryDate: this.openingForm.entryDate,
    };
  }
  private cents(value: string): number {
    const amount = Number(value.replace(',', '.'));
    return Math.round(amount * CENTS_PER_UNIT);
  }
  private replace<T extends { id: string }>(
    target: { update: (update: (items: ReadonlyArray<T>) => ReadonlyArray<T>) => void },
    value: T,
  ): void {
    target.update((items) =>
      items.map((item) => {
        if (item.id === value.id) return value;
        return item;
      }),
    );
  }
  private async run(operation: () => Promise<boolean>): Promise<void> {
    this.busy.set(true);
    this.clearMessages();
    try {
      if (await operation()) this.notice.set('accounting.saved');
      else this.error.set('accounting.error');
    } catch {
      this.error.set('accounting.error');
    } finally {
      this.busy.set(false);
    }
  }
  private clearMessages(): void {
    this.notice.set(null);
    this.error.set(null);
  }
  private download(content: string, fileName: string, mediaType: string): void {
    this.downloadBlob(new Blob([content], { type: mediaType }), fileName);
  }
  private downloadBlob(content: Blob, fileName: string): void {
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
