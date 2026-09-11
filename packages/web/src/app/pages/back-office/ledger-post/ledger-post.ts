import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PendingTasks,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LedgerSourceKind,
  Ulid,
  type LedgerEntry,
  type LedgerRequest,
  type LedgerSourceDetail,
} from '@froment/contracts';
import { Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { BankLedgerApi } from '@backoffice/bank-ledger-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { ledgerErrorMessage } from '../bank-ledger/ledger-error-message';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import {
  bankQueryParams,
  ledgerEntryLink,
  ledgerQuery,
  ledgerSourceLabel,
  transactionLink,
} from '../banking/bank-workspace';

const blank = () => ({ debitAccount: '', creditAccount: '', label: '' });
type EntryField = keyof ReturnType<typeof blank>;
@Component({
  selector: 'app-ledger-post',
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [Button, FormField, LocalizedDatePipe, Notice, PageHeader, RouterLink],
  templateUrl: './ledger-post.html',
  styleUrl: './ledger-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerPost {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankLedgerApi);
  private readonly confirmation = inject(Confirmation);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly busy = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly errorMessage = computed(() =>
    ledgerErrorMessage(this.error(), this.state() === 'ready' ? 'post' : 'load'),
  );
  protected readonly detail = signal<typeof LedgerSourceDetail.Type | undefined>(undefined);
  protected readonly completed = signal<typeof LedgerEntry.Type | undefined>(undefined);
  protected readonly pending = signal<typeof LedgerRequest.Type | undefined>(undefined);
  private readonly model = signal(blank());
  protected readonly entryForm = form(this.model, (path) => {
    required(path.debitAccount);
    required(path.creditAccount);
    required(path.label);
    pattern(path.debitAccount, /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/);
    pattern(path.creditAccount, /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/);
    validate(path.creditAccount, ({ value, valueOf }) =>
      value() === valueOf(path.debitAccount) ? { kind: 'identical' } : undefined,
    );
    maxLength(path.label, 160);
    pattern(path.label, /\S/);
    disabled(
      path,
      () => this.busy() || this.state() !== 'ready' || !!this.pending() || !!this.completed(),
    );
  });
  protected readonly backQuery = bankQueryParams(ledgerQuery(this.route.snapshot.queryParamMap));
  protected readonly entryLink = ledgerEntryLink;
  protected readonly sourceLabel = ledgerSourceLabel;
  protected readonly submitLabel = computed<TranslationKey>(() =>
    this.pending() ? 'bankWorkspace.retry' : 'ledger.post',
  );
  protected readonly creditAccountError = computed<TranslationKey>(() => {
    const { creditAccount, debitAccount } = this.model();
    if (creditAccount !== '' && creditAccount === debitAccount)
      return 'bankWorkspace.accountsDistinct';
    return 'bankWorkspace.accountCodeInvalid';
  });
  protected readonly transactionLink = transactionLink;
  private generation = 0;
  private requestKey: { fingerprint: string; id: string } | undefined;
  constructor() {
    afterRenderEffect(() => {
      if (this.completed()) this.result()?.nativeElement.focus();
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
    this.state.set('loading');
    this.error.set(undefined);
    this.detail.set(undefined);
    this.completed.set(undefined);
    this.pending.set(undefined);
    this.requestKey = undefined;
    this.entryForm().reset(blank());
    const id = this.route.snapshot.paramMap.get('sourceId');
    const kind = this.route.snapshot.paramMap.get('sourceKind');
    if (!Schema.is(Ulid)(id) || !Schema.is(LedgerSourceKind)(kind)) {
      this.error.set('bankWorkspace.sourceMissing');
      this.state.set('error');
      return;
    }
    try {
      const outcome = await this.api.getSource(kind, id);
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(
          outcome.code === 'ledger.conflict' ? 'bankWorkspace.sourceMissing' : outcome.code,
        );
        this.state.set('error');
        return;
      }
      this.detail.set(outcome.result);
      this.state.set('ready');
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) {
        this.error.set('ledger.error');
        this.state.set('error');
      }
    }
  }
  protected invalid(field: EntryField): boolean {
    return this.entryForm[field]().touched() && this.entryForm[field]().invalid();
  }
  protected async refresh(): Promise<void> {
    if (this.pending()) return;
    if (await this.canDeactivate()) await this.load();
  }
  protected post(event: SubmitEvent): void {
    event.preventDefault();
    if (
      this.busy() ||
      this.completed() ||
      this.state() !== 'ready' ||
      this.detail()?.source.entryId !== null
    )
      return;
    if (this.pending()) {
      void this.send(false);
      return;
    }
    this.entryForm().markAsTouched();
    for (const field of ['debitAccount', 'creditAccount', 'label'] as const)
      if (this.entryForm[field]().invalid()) {
        this.entryForm[field]().focusBoundControl();
        return;
      }
    void submit(this.entryForm, async () => {
      const source = this.detail()?.source;
      if (!source) return;
      const payload = {
        ...this.model(),
        label: this.model().label.trim(),
        sourceKind: source.sourceKind,
        sourceId: source.sourceId,
        bookedOn: source.postingDate,
      };
      const fingerprint = JSON.stringify(payload);
      if (this.requestKey?.fingerprint !== fingerprint)
        this.requestKey = { fingerprint, id: crypto.randomUUID() };
      this.pending.set({ ...payload, requestId: this.requestKey.id });
      await this.send();
    });
  }
  private async send(confirm = true): Promise<void> {
    const request = this.pending();
    const source = this.detail()?.source;
    if (!request || !source || this.busy()) return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      if (
        confirm &&
        !(await this.confirmation.request(
          this.i18n.tf('ledger.confirmPost', {
            debit: request.debitAccount,
            credit: request.creditAccount,
            amount: this.money(source.amountCents),
          }),
        ))
      ) {
        this.pending.set(undefined);
        return;
      }
      const outcome = await this.api.post(request);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        if (outcome.code !== 'ledger.error') this.pending.set(undefined);
        return;
      }
      this.completed.set(outcome.result);
      this.pending.set(undefined);
      this.entryForm().reset();
    } catch {
      if (!this.destroyRef.destroyed) this.error.set('ledger.error');
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  private dirty(): boolean {
    return !this.completed() && (this.entryForm().dirty() || !!this.pending());
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
