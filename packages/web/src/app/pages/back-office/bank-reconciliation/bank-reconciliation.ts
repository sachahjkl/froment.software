import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Ulid,
  type BankAllocation,
  type BankMatchHistory,
  type BankMatchRequest,
  type BankPaymentList,
  type BankTransactionValue,
  type InvoiceListValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { BankingApi } from '@backoffice/banking-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { Confirmation } from '@shared/confirmation/confirmation';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TableSort } from '@shared/table-sort/table-sort';
import {
  allocationColumns,
  historyColumns,
  bankQuery,
  bankQueryParams,
  bankStatus,
  bankStatusLabel,
} from '../banking/bank-workspace';
import {
  bankTableSort,
  bankSortDirection,
  compareBankRows,
  nextBankSort,
} from '../banking/bank-table-sort';

const blankMatch = () => ({ invoiceId: '', paymentId: '', amount: '', fee: '0.00' });
type MatchField = keyof ReturnType<typeof blankMatch>;

@Component({
  selector: 'app-bank-reconciliation',
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [
    Badge,
    Button,
    DataTable,
    FormField,
    LocalizedDatePipe,
    Notice,
    PageHeader,
    RouterLink,
    TableSort,
  ],
  templateUrl: './bank-reconciliation.html',
  styleUrl: './bank-reconciliation.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankReconciliation {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankingApi);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  private readonly confirmation = inject(Confirmation);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  private readonly cancelReason = viewChild<ElementRef<HTMLTextAreaElement>>('cancelReason');
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saved = signal(false);
  protected readonly transaction = signal<BankTransactionValue | undefined>(undefined);
  protected readonly titleLabel = computed<TranslationKey>(() =>
    (this.transaction()?.amountCents ?? 0) < 0
      ? 'bankWorkspace.context'
      : 'bankWorkspace.reconciliation',
  );
  protected readonly invoices = signal<InvoiceListValue>([]);
  protected readonly invoicesFailed = signal(false);
  protected readonly invoicesLoading = signal(false);
  protected readonly payments = signal<typeof BankPaymentList.Type>([]);
  protected readonly paymentState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  protected readonly history = signal<typeof BankMatchHistory.Type>([]);
  protected readonly allocationColumns = allocationColumns;
  protected readonly historyColumns = historyColumns;
  protected readonly allocationSort = computed(() =>
    bankTableSort(this.params().get('allocationSort'), allocationColumns),
  );
  protected readonly historySort = computed(() =>
    bankTableSort(this.params().get('historySort'), historyColumns),
  );
  protected readonly sortedAllocations = computed(() =>
    (this.transaction()?.allocations ?? []).toSorted(
      compareBankRows(
        this.allocationSort(),
        allocationColumns,
        this.i18n.language(),
        (row) => row.matchId,
        // Le contrat des allocations actives ne contient pas de date.
        'invoice-asc',
      ),
    ),
  );
  protected readonly sortedHistory = computed(() =>
    this.history().toSorted(
      compareBankRows(this.historySort(), historyColumns, this.i18n.language(), (row) => row.id),
    ),
  );
  protected readonly historyState = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly cancelling = signal<typeof BankAllocation.Type | undefined>(undefined);
  protected readonly pendingMatch = signal<typeof BankMatchRequest.Type | undefined>(undefined);
  protected readonly pendingCancellation = signal<{ matchId: string; reason: string } | undefined>(
    undefined,
  );
  private readonly model = signal(blankMatch());
  protected readonly matchForm = form(this.model, (path) => {
    disabled(
      path,
      () =>
        this.busy() ||
        this.state() !== 'ready' ||
        this.pendingMatch() !== undefined ||
        this.cancelling() !== undefined,
    );
    required(path.invoiceId);
    validate(path.invoiceId, ({ value }) =>
      this.invoices().some((invoice) => invoice.id === value()) ? undefined : { kind: 'invoice' },
    );
    required(path.paymentId);
    validate(path.paymentId, ({ value }) =>
      this.payments().some((payment) => payment.id === value()) ? undefined : { kind: 'payment' },
    );
    required(path.amount);
    validate(path.amount, ({ value, valueOf }) => {
      const amount = parseFixedDecimal(value(), 2);
      const payment = this.payments().find((payment) => payment.id === valueOf(path.paymentId));
      return amount !== undefined &&
        amount > 0 &&
        payment !== undefined &&
        amount <= payment.availableCents
        ? undefined
        : { kind: 'amount' };
    });
    required(path.fee);
    validate(path.fee, ({ value, valueOf }) => {
      const fee = parseFixedDecimal(value(), 2);
      const amount = parseFixedDecimal(valueOf(path.amount), 2);
      return fee !== undefined && fee >= 0 && amount !== undefined && fee < amount
        ? undefined
        : { kind: 'fee' };
    });
  });
  protected readonly cancelForm = form(signal({ reason: '' }), (path) => {
    required(path.reason);
    pattern(path.reason, /\S/);
    maxLength(path.reason, 500);
    disabled(path, () => this.busy() || this.pendingCancellation() !== undefined);
  });
  protected readonly net = computed(() => {
    const amount = parseFixedDecimal(this.model().amount, 2);
    const fee = parseFixedDecimal(this.model().fee, 2);
    return amount === undefined || fee === undefined ? undefined : amount - fee;
  });
  protected readonly remaining = computed(() => {
    const item = this.transaction();
    return item ? item.amountCents - item.matchedCents : 0;
  });
  protected readonly netInvalid = computed(() => {
    const net = this.net();
    return net !== undefined && net > this.remaining();
  });
  protected readonly status = computed(() => {
    const item = this.transaction();
    return bankStatusLabel(item ? bankStatus(item) : 'unmatched');
  });
  protected readonly backQuery = bankQueryParams(bankQuery(this.route.snapshot.queryParamMap));
  private generation = 0;
  private paymentGeneration = 0;
  private historyGeneration = 0;
  private matchKey: { fingerprint: string; id: string } | undefined;

  constructor() {
    afterRenderEffect(() => {
      if (this.saved()) this.result()?.nativeElement.focus();
    });
    afterRenderEffect(() => {
      if (this.cancelling()) this.cancelReason()?.nativeElement.focus();
    });
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.pendingTasks.run(() => this.load())),
    );
  }
  protected async load(): Promise<void> {
    if (this.busy()) return;
    const generation = ++this.generation;
    ++this.paymentGeneration;
    this.state.set('loading');
    this.error.set(undefined);
    this.saved.set(false);
    this.transaction.set(undefined);
    this.payments.set([]);
    this.paymentState.set('idle');
    this.cancelling.set(undefined);
    this.pendingMatch.set(undefined);
    this.pendingCancellation.set(undefined);
    this.matchKey = undefined;
    this.matchForm().reset(blankMatch());
    this.cancelForm().reset({ reason: '' });
    const id = this.route.snapshot.paramMap.get('transactionId');
    if (!Schema.is(Ulid)(id)) {
      this.error.set('bank.transaction_not_found');
      this.state.set('error');
      return;
    }
    try {
      const outcome = await this.api.get(id);
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.state.set('error');
        return;
      }
      this.transaction.set(outcome.result);
      this.resetMatch();
      this.state.set('ready');
      await Promise.all([this.loadHistory(), this.loadInvoices()]);
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) {
        this.error.set('bank.error');
        this.state.set('error');
      }
    }
  }
  protected async loadInvoices(): Promise<void> {
    const generation = this.generation;
    this.invoicesFailed.set(false);
    this.invoicesLoading.set(true);
    try {
      const invoices = await this.invoicesApi.list();
      if (generation === this.generation && !this.destroyRef.destroyed)
        this.invoices.set(
          invoices.filter((invoice) => invoice.status === 'issued' || invoice.status === 'paid'),
        );
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed)
        this.invoicesFailed.set(true);
    } finally {
      if (generation === this.generation && !this.destroyRef.destroyed)
        this.invoicesLoading.set(false);
    }
  }
  protected async refresh(): Promise<void> {
    if (this.pendingMatch() || this.pendingCancellation()) return;
    if (await this.canDeactivate()) await this.load();
  }
  protected async selectInvoice(id: string): Promise<void> {
    if (this.busy() || this.pendingMatch()) return;
    const generation = ++this.paymentGeneration;
    this.model.update((model) => ({ ...model, invoiceId: id, paymentId: '' }));
    this.payments.set([]);
    this.paymentState.set('idle');
    if (!this.invoices().some((invoice) => invoice.id === id)) return;
    this.paymentState.set('loading');
    try {
      const outcome = await this.api.payments(id);
      if (generation !== this.paymentGeneration || this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.paymentState.set('error');
        return;
      }
      this.payments.set(outcome.result.filter((payment) => payment.availableCents > 0));
      this.paymentState.set('ready');
    } catch {
      if (generation === this.paymentGeneration && !this.destroyRef.destroyed)
        this.paymentState.set('error');
    }
  }
  protected invalid(field: MatchField): boolean {
    return this.matchForm[field]().touched() && this.matchForm[field]().invalid();
  }
  protected reconcile(event: SubmitEvent): void {
    event.preventDefault();
    if (
      this.busy() ||
      this.cancelling() ||
      this.paymentState() === 'loading' ||
      this.state() !== 'ready'
    )
      return;
    if (this.pendingMatch()) {
      void this.sendMatch(false);
      return;
    }
    this.matchForm().markAsTouched();
    for (const field of ['invoiceId', 'paymentId', 'amount', 'fee'] as const) {
      if (this.matchForm[field]().invalid()) {
        this.matchForm[field]().focusBoundControl();
        return;
      }
    }
    if (this.netInvalid()) {
      this.matchForm.amount().focusBoundControl();
      return;
    }
    void submit(this.matchForm, async () => {
      const amountCents = parseFixedDecimal(this.model().amount, 2);
      const feeCents = parseFixedDecimal(this.model().fee, 2);
      if (amountCents === undefined || feeCents === undefined) return;
      const payload = { paymentId: this.model().paymentId, amountCents, feeCents };
      const fingerprint = JSON.stringify(payload);
      if (this.matchKey?.fingerprint !== fingerprint)
        this.matchKey = { fingerprint, id: crypto.randomUUID() };
      this.pendingMatch.set({ ...payload, requestId: this.matchKey.id });
      await this.sendMatch();
    });
  }
  private async sendMatch(confirm = true): Promise<void> {
    const transaction = this.transaction();
    const request = this.pendingMatch();
    if (!transaction || !request || this.busy()) return;
    this.busy.set(true);
    this.error.set(undefined);
    this.saved.set(false);
    try {
      if (
        confirm &&
        !(await this.confirmation.request(this.i18n.t('bankWorkspace.confirmMatch')))
      ) {
        this.pendingMatch.set(undefined);
        return;
      }
      const outcome = await this.api.match(transaction.id, request);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        if (outcome.code !== 'bank.error') this.pendingMatch.set(undefined);
        return;
      }
      this.pendingMatch.set(undefined);
      this.matchKey = undefined;
      await this.complete(transaction.id, outcome.result);
    } catch {
      if (!this.destroyRef.destroyed) this.error.set('bank.error');
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  protected async selectCancellation(allocation: typeof BankAllocation.Type): Promise<void> {
    if (this.busy() || this.pendingMatch() || this.pendingCancellation()) return;
    // L’état dirty exclut les champs désactivés par busy.
    const needsConfirmation = this.cancelForm().dirty() || this.matchForm().dirty();
    const focusTarget = this.document.activeElement;
    this.busy.set(true);
    try {
      if (
        needsConfirmation &&
        !(await this.confirmation.request(this.i18n.t('bankWorkspace.unsaved')))
      ) {
        if (!this.destroyRef.destroyed) {
          afterNextRender(
            () => {
              if (!this.busy() && focusTarget instanceof HTMLElement && focusTarget.isConnected)
                focusTarget.focus();
            },
            { injector: this.injector },
          );
        }
        return;
      }
      if (
        this.destroyRef.destroyed ||
        !this.transaction()?.allocations.some((item) => item.matchId === allocation.matchId)
      )
        return;
      this.resetMatch();
      this.cancelling.set(allocation);
      this.cancelForm().reset({ reason: '' });
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  protected async closeCancellation(): Promise<void> {
    if (this.busy() || this.pendingCancellation()) return;
    if (
      this.cancelForm().dirty() &&
      !(await this.confirmation.request(this.i18n.t('bankWorkspace.unsaved')))
    )
      return;
    this.cancelling.set(undefined);
    this.cancelForm().reset({ reason: '' });
  }
  protected cancelAllocation(event: SubmitEvent): void {
    event.preventDefault();
    if (this.busy()) return;
    if (this.pendingCancellation()) {
      void this.sendCancellation(false);
      return;
    }
    this.cancelForm().markAsTouched();
    if (this.cancelForm.reason().invalid()) {
      this.cancelForm.reason().focusBoundControl();
      return;
    }
    void submit(this.cancelForm, async () => {
      const transaction = this.transaction();
      const allocation = this.cancelling();
      const reason = this.cancelForm().value().reason.trim();
      if (!transaction || !allocation) return;
      this.pendingCancellation.set({ matchId: allocation.matchId, reason });
      await this.sendCancellation();
    });
  }
  private async sendCancellation(confirm = true): Promise<void> {
    const transaction = this.transaction();
    const request = this.pendingCancellation();
    if (!transaction || !request || this.busy()) return;
    this.busy.set(true);
    this.saved.set(false);
    this.error.set(undefined);
    try {
      if (
        confirm &&
        !(await this.confirmation.request(this.i18n.t('bankWorkspace.confirmUnmatch')))
      ) {
        this.pendingCancellation.set(undefined);
        return;
      }
      const outcome = await this.api.unmatch(transaction.id, request.matchId, request.reason);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        if (outcome.code !== 'bank.error') this.pendingCancellation.set(undefined);
        return;
      }
      this.pendingCancellation.set(undefined);
      this.cancelling.set(undefined);
      this.cancelForm().reset({ reason: '' });
      await this.complete(transaction.id, outcome.result);
    } catch {
      if (!this.destroyRef.destroyed) this.error.set('bank.error');
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  private async complete(id: string, transactions: readonly BankTransactionValue[]): Promise<void> {
    const current = transactions.find((transaction) => transaction.id === id);
    if (current) this.transaction.set(current);
    else {
      const outcome = await this.api.get(id);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.state.set('error');
        return;
      }
      this.transaction.set(outcome.result);
    }
    this.resetMatch();
    this.saved.set(true);
    await this.loadHistory();
  }
  private resetMatch(): void {
    ++this.paymentGeneration;
    this.payments.set([]);
    this.paymentState.set('idle');
    this.matchForm().reset({
      ...blankMatch(),
      amount: formatFixedDecimal(Math.max(0, this.remaining()), 2, '.'),
    });
  }
  protected async loadHistory(): Promise<void> {
    const id = this.transaction()?.id;
    if (!id) return;
    const generation = ++this.historyGeneration;
    this.history.set([]);
    this.historyState.set('loading');
    try {
      const outcome = await this.api.history(id);
      if (
        generation !== this.historyGeneration ||
        this.destroyRef.destroyed ||
        this.transaction()?.id !== id
      )
        return;
      if (!outcome.success) {
        this.historyState.set('error');
        return;
      }
      this.history.set(outcome.result);
      this.historyState.set('ready');
    } catch {
      if (generation === this.historyGeneration && !this.destroyRef.destroyed)
        this.historyState.set('error');
    }
  }
  protected ledgerQuery() {
    const item = this.transaction();
    return { from: item?.bookedOn, to: item?.bookedOn, q: item?.reference };
  }
  protected sortDirection(table: 'allocation' | 'history', column: string) {
    return bankSortDirection(
      table === 'allocation' ? this.allocationSort() : this.historySort(),
      column,
    );
  }
  protected sortBy(table: 'allocation' | 'history', column: string): void {
    const sort = table === 'allocation' ? this.allocationSort() : this.historySort();
    const nextSort = nextBankSort(sort, column);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [table === 'allocation' ? 'allocationSort' : 'historySort']:
          nextSort === 'none' ? null : nextSort,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  private dirty(): boolean {
    return (
      this.matchForm().dirty() ||
      this.cancelForm().dirty() ||
      this.pendingMatch() !== undefined ||
      this.pendingCancellation() !== undefined
    );
  }
  async canDeactivate(): Promise<boolean> {
    return (
      !this.busy() &&
      (!this.dirty() || (await this.confirmation.request(this.i18n.t('bankWorkspace.unsaved'))))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.dirty()) event.preventDefault();
  }
}
