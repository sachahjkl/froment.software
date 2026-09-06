import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  LedgerEntry,
  LedgerList,
  LedgerPeriod,
  LedgerRequest,
  LedgerReverse,
  LedgerSource,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { BankLedgerApi } from '@backoffice/bank-ledger-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  selector: 'app-bank-ledger',
  imports: [Button, FormField, Notice, RouterLink, LocalizedDatePipe],
  templateUrl: './bank-ledger.html',
  styleUrl: './bank-ledger.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class BankLedger {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(BankLedgerApi);
  private readonly confirmation = inject(Confirmation);
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saved = signal(false);
  protected readonly records = signal<typeof LedgerList.Type | undefined>(undefined);
  protected readonly selected = signal<typeof LedgerSource.Type | undefined>(undefined);
  protected readonly reversing = signal<typeof LedgerEntry.Type | undefined>(undefined);
  private requestId: string | undefined;
  protected readonly period = form(signal({ from: '', to: '' }), (path) => {
    required(path.from);
    required(path.to);
    disabled(path, () => this.busy() || this.loading());
  });
  protected readonly entryForm = form(
    signal({ debitAccount: '', creditAccount: '', label: '' }),
    (path) => {
      required(path.debitAccount);
      required(path.creditAccount);
      required(path.label);
      pattern(path.debitAccount, /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/);
      pattern(path.creditAccount, /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/);
      maxLength(path.label, 160);
      pattern(path.label, /\S/);
      disabled(path, () => this.busy() || this.loading());
    },
  );
  protected readonly reversalForm = form(signal({ reason: '', bookedOn: '' }), (path) => {
    required(path.reason);
    required(path.bookedOn);
    maxLength(path.reason, 160);
    pattern(path.reason, /\S/);
    disabled(path, () => this.busy() || this.loading());
  });
  private readonly loadedPeriod = signal<typeof LedgerPeriod.Type | undefined>(undefined);
  protected readonly exportUrl = computed(() => {
    const period = this.loadedPeriod();
    return period === undefined
      ? undefined
      : `/api/banking/ledger/export?${new URLSearchParams(period)}`;
  });
  constructor() {
    afterNextRender(() => {
      const year = new Date().getFullYear();
      this.period().reset({ from: `${year}-01-01`, to: `${year}-12-31` });
      void this.load();
    });
  }
  protected async load(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.busy() || this.loading()) return;
    const period = Schema.decodeUnknownOption(LedgerPeriod)(this.period().value());
    if (Option.isNone(period)) {
      this.error.set('ledger.conflict');
      return;
    }
    this.loading.set(true);
    try {
      const outcome = await this.api.list(period.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        this.records.set(undefined);
        this.loadedPeriod.set(undefined);
        return;
      }
      this.records.set(outcome.result);
      this.loadedPeriod.set(period.value);
      this.error.set(undefined);
    } finally {
      this.loading.set(false);
    }
  }
  protected async select(source: typeof LedgerSource.Type): Promise<void> {
    if (this.busy() || this.loading() || !(await this.canDeactivate())) return;
    this.reset();
    this.selected.set(source);
  }
  protected async selectReversal(entry: typeof LedgerEntry.Type): Promise<void> {
    if (this.busy() || this.loading() || !(await this.canDeactivate())) return;
    this.reset();
    this.reversing.set(entry);
  }
  protected async cancel(): Promise<void> {
    if (await this.canDeactivate()) this.reset();
  }
  private reset(): void {
    this.selected.set(undefined);
    this.reversing.set(undefined);
    this.requestId = undefined;
    this.entryForm().reset({ debitAccount: '', creditAccount: '', label: '' });
    this.reversalForm().reset({ reason: '', bookedOn: '' });
  }
  protected post(event: Event): void {
    event.preventDefault();
    if (this.busy() || this.loading()) return;
    void submit(this.entryForm, {
      action: async () => {
        const source = this.selected();
        if (source === undefined) return;
        this.requestId ??= crypto.randomUUID();
        const request = Schema.decodeUnknownOption(LedgerRequest)({
          ...this.entryForm().value(),
          requestId: this.requestId,
          sourceId: source.sourceId,
          sourceKind: source.sourceKind,
        });
        if (Option.isNone(request)) {
          this.error.set('ledger.conflict');
          return;
        }
        this.busy.set(true);
        try {
          if (
            !(await this.confirmation.request(
              this.i18n.tf('ledger.confirmPost', {
                debit: request.value.debitAccount,
                credit: request.value.creditAccount,
                amount: this.money(source.amountCents),
              }),
            ))
          )
            return;
          const outcome = await this.api.post(request.value);
          if (!outcome.success) {
            this.error.set(outcome.code);
            return;
          }
          this.reset();
          this.saved.set(true);
          this.error.set(undefined);
          this.result()?.nativeElement.focus();
        } finally {
          this.busy.set(false);
        }
        await this.load();
      },
    });
  }
  protected reverse(event: Event): void {
    event.preventDefault();
    if (this.busy() || this.loading()) return;
    void submit(this.reversalForm, {
      action: async () => {
        const original = this.reversing();
        if (original === undefined) return;
        this.requestId ??= crypto.randomUUID();
        const request = Schema.decodeUnknownOption(LedgerReverse)({
          ...this.reversalForm().value(),
          requestId: this.requestId,
        });
        if (Option.isNone(request)) {
          this.error.set('ledger.conflict');
          return;
        }
        this.busy.set(true);
        try {
          if (!(await this.confirmation.request(this.i18n.t('ledger.confirmReverse')))) return;
          const outcome = await this.api.reverse(original.id, request.value);
          if (!outcome.success) {
            this.error.set(outcome.code);
            return;
          }
          this.reset();
          this.saved.set(true);
          this.error.set(undefined);
          this.result()?.nativeElement.focus();
        } finally {
          this.busy.set(false);
        }
        await this.load();
      },
    });
  }
  protected money(value: number): string {
    return formatMoney(value, this.i18n.language(), 'EUR');
  }
  private dirty(): boolean {
    return this.entryForm().dirty() || this.reversalForm().dirty();
  }
  canDeactivate(): boolean | Promise<boolean> {
    return (
      !this.busy() &&
      (!this.dirty() || this.confirmation.request(this.i18n.t('backOffice.invoice.unsavedChanges')))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
