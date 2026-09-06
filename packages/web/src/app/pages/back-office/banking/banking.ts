import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FormField,
  disabled,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import {
  type BankTransactionValue,
  type InvoiceListValue,
  type InvoicePayment,
} from '@froment/contracts';
import { BankingApi } from '@backoffice/banking-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { formatMoney } from '@froment/l10n';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  imports: [Button, Notice, FormField, LocalizedDatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-banking',
  styleUrl: './banking.scss',
  templateUrl: './banking.html',
})
export class Banking {
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankingApi);
  private readonly invoicesApi = inject(InvoicesApi);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saved = signal(false);
  protected readonly transactions = signal<ReadonlyArray<BankTransactionValue>>([]);
  protected readonly invoices = signal<InvoiceListValue>([]);
  protected readonly selected = signal<BankTransactionValue | undefined>(undefined);
  protected readonly payments = signal<ReadonlyArray<typeof InvoicePayment.Type>>([]);
  protected readonly paymentLoading = signal(false);
  protected readonly csv = signal('');
  protected readonly filename = signal('');
  protected readonly importResult = signal<{ added: number; existing: number } | undefined>(
    undefined,
  );
  private readonly importModel = signal({ account: '' });
  protected readonly importForm = form(this.importModel, (path) => {
    required(path.account);
    pattern(path.account, /\S/);
    maxLength(path.account, 100);
    disabled(path, () => this.saving());
  });
  protected readonly filters = form(signal({ search: '', unmatched: true }));
  protected readonly matchForm = form(signal({ paymentId: '', reason: '' }), (path) => {
    maxLength(path.reason, 500);
    disabled(path, () => this.saving());
  });
  protected readonly visible = computed(() => {
    const filter = this.filters().value();
    return this.transactions().filter(
      (transaction) =>
        (!filter.unmatched || transaction.paymentId === null || transaction.paymentCancelled) &&
        `${transaction.account} ${transaction.reference} ${transaction.description}`
          .toLocaleLowerCase()
          .includes(filter.search.toLocaleLowerCase()),
    );
  });
  private readonly result = viewChild('result', { read: ElementRef<HTMLElement> });
  private readonly editor = viewChild('editor', { read: ElementRef<HTMLElement> });
  private readonly fileInput = viewChild('statementFile', { read: ElementRef<HTMLInputElement> });
  private selectionVersion = 0;
  private fileVersion = 0;
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  async load(): Promise<void> {
    if (this.saving()) return;
    this.loading.set(true);
    this.error.set(undefined);
    try {
      const [transactions, invoices] = await Promise.all([
        this.api.list(),
        this.invoicesApi.list(),
      ]);
      this.transactions.set(transactions);
      this.invoices.set(
        invoices.filter((invoice) => invoice.status === 'issued' || invoice.status === 'paid'),
      );
    } catch {
      this.error.set('bank.error');
    } finally {
      this.loading.set(false);
    }
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.saving() &&
      ((this.csv() === '' && !this.matchForm().dirty()) ||
        (await this.confirmation.request(this.i18n.t('backOffice.quote.unsavedChanges'))))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnload(event: BeforeUnloadEvent): void {
    if (this.csv() !== '' || this.saving() || this.matchForm().dirty()) event.preventDefault();
  }
  protected async readFile(input: HTMLInputElement): Promise<void> {
    const version = ++this.fileVersion;
    this.csv.set('');
    this.filename.set('');
    this.error.set(undefined);
    this.importResult.set(undefined);
    const file = input.files?.[0];
    if (file === undefined) return;
    if (file.size > 500000) {
      this.error.set('bank.import_invalid');
      return;
    }
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (version !== this.fileVersion) return;
      this.csv.set(text);
      this.filename.set(file.name);
    } catch {
      if (version === this.fileVersion) this.error.set('bank.import_invalid');
    }
  }
  protected importStatement(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.csv() === '') return;
    void submit(this.importForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      this.saved.set(false);
      try {
        const outcome = await this.api.importStatement({
          account: this.importModel().account.trim(),
          csv: this.csv(),
        });
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.importResult.set(outcome.result);
        this.csv.set('');
        this.filename.set('');
        const input = this.fileInput();
        if (input !== undefined) input.nativeElement.value = '';
        this.importForm().reset();
        this.transactions.set(await this.api.list());
        this.saved.set(true);
        this.result()?.nativeElement.focus();
      } catch {
        this.error.set('bank.error');
      } finally {
        this.saving.set(false);
      }
    });
  }
  protected async select(transaction: BankTransactionValue): Promise<void> {
    if (this.saving()) return;
    if (
      this.matchForm().dirty() &&
      !(await this.confirmation.request(this.i18n.t('backOffice.quote.unsavedChanges')))
    )
      return;
    this.selected.set(transaction);
    this.payments.set([]);
    this.matchForm().reset({ paymentId: '', reason: '' });
    this.selectionVersion++;
    this.paymentLoading.set(false);
    this.editor()?.nativeElement.focus();
  }
  protected async loadPayments(invoiceId: string): Promise<void> {
    const version = ++this.selectionVersion;
    this.payments.set([]);
    this.matchForm.paymentId().value.set('');
    if (invoiceId === '') {
      this.paymentLoading.set(false);
      return;
    }
    this.paymentLoading.set(true);
    try {
      const outcome = await this.invoicesApi.get(invoiceId);
      if (version !== this.selectionVersion) return;
      if (!outcome.success) {
        this.error.set('bank.error');
        return;
      }
      const selected = this.selected();
      this.payments.set(
        outcome.result.payments.filter(
          (payment) =>
            payment.cancelledAt === null &&
            payment.amountCents === selected?.amountCents &&
            !this.transactions().some((transaction) => transaction.paymentId === payment.id),
        ),
      );
    } finally {
      if (version === this.selectionVersion) this.paymentLoading.set(false);
    }
  }
  protected async reconcile(): Promise<void> {
    const selected = this.selected();
    const paymentId = this.matchForm().value().paymentId;
    if (
      this.saving() ||
      selected === undefined ||
      !this.payments().some((payment) => payment.id === paymentId)
    )
      return;
    if (!(await this.confirmation.request(this.i18n.t('bank.confirmMatch')))) return;
    this.saving.set(true);
    this.error.set(undefined);
    this.saved.set(false);
    try {
      const outcome = await this.api.match(selected.id, paymentId);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.complete(outcome.result);
    } finally {
      this.saving.set(false);
    }
  }
  protected async unmatch(): Promise<void> {
    const selected = this.selected();
    const reason = this.matchForm().value().reason.trim();
    if (this.saving() || selected?.matchId == null || reason === '' || this.matchForm().invalid())
      return;
    if (!(await this.confirmation.request(this.i18n.t('bank.confirmUnmatch')))) return;
    this.saving.set(true);
    this.error.set(undefined);
    this.saved.set(false);
    try {
      const outcome = await this.api.unmatch(selected.id, selected.matchId, reason);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.complete(outcome.result);
    } finally {
      this.saving.set(false);
    }
  }
  private complete(transactions: ReadonlyArray<BankTransactionValue>): void {
    this.transactions.set(transactions);
    this.selected.set(undefined);
    this.matchForm().reset({ paymentId: '', reason: '' });
    this.saved.set(true);
    this.result()?.nativeElement.focus();
  }
  protected amount(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
