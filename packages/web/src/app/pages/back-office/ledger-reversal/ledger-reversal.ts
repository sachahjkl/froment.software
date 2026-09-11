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
import { CalendarDate, Ulid, type LedgerEntry, type LedgerReverse } from '@froment/contracts';
import { Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { BankLedgerApi } from '@backoffice/bank-ledger-api';
import { Authentication } from '@backoffice/authentication';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import {
  bankQueryParams,
  ledgerEntryLink,
  ledgerEntryStatusLabel,
  ledgerQuery,
  ledgerSourceLink,
  ledgerSourceLabel,
} from '../banking/bank-workspace';

const blank = () => ({ reason: '', bookedOn: '' });
@Component({
  selector: 'app-ledger-reversal',
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [Can, Badge, Button, FormField, LocalizedDatePipe, Notice, PageHeader, RouterLink],
  templateUrl: './ledger-reversal.html',
  styleUrl: './ledger-reversal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LedgerReversal {
  private readonly authentication = inject(Authentication);
  protected readonly titleLabel = computed<TranslationKey>(() =>
    this.authentication.can('ledger.post') ? 'bankWorkspace.reverseTitle' : 'bankWorkspace.entries',
  );
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
  protected readonly entry = signal<typeof LedgerEntry.Type | undefined>(undefined);
  protected readonly completed = signal<typeof LedgerEntry.Type | undefined>(undefined);
  protected readonly pending = signal<typeof LedgerReverse.Type | undefined>(undefined);
  private readonly model = signal(blank());
  private readonly baseline = JSON.stringify(this.model());
  protected readonly reversalForm = form(this.model, (path) => {
    required(path.reason);
    pattern(path.reason, /\S/);
    maxLength(path.reason, 160);
    required(path.bookedOn);
    validate(path.bookedOn, ({ value }) => {
      const date = value();
      const entry = this.entry();
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      return Schema.is(CalendarDate)(date) &&
        entry !== undefined &&
        date >= entry.bookedOn &&
        date <= today
        ? undefined
        : { kind: 'date' };
    });
    disabled(
      path,
      () => this.busy() || this.state() !== 'ready' || !!this.pending() || !!this.completed(),
    );
  });
  // Date-validity animations can mark unchanged values as dirty. Keep native parse errors protected.
  private readonly hasUnsavedChanges = computed(
    () =>
      JSON.stringify(this.model()) !== this.baseline ||
      this.reversalForm()
        .errorSummary()
        .some((error) => error.kind === 'parse'),
  );
  protected readonly backQuery = bankQueryParams(ledgerQuery(this.route.snapshot.queryParamMap));
  protected readonly entryLink = ledgerEntryLink;
  protected readonly sourceLink = ledgerSourceLink;
  protected readonly sourceLabel = ledgerSourceLabel;
  protected readonly statusLabel = ledgerEntryStatusLabel;
  protected readonly submitLabel = computed<TranslationKey>(() =>
    this.pending() ? 'bankWorkspace.retry' : 'ledger.reverse',
  );
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
    this.entry.set(undefined);
    this.completed.set(undefined);
    this.pending.set(undefined);
    this.requestKey = undefined;
    this.reversalForm().reset(blank());
    const id = this.route.snapshot.paramMap.get('entryId');
    if (!Schema.is(Ulid)(id)) {
      this.error.set('bankWorkspace.entryMissing');
      this.state.set('error');
      return;
    }
    try {
      const outcome = await this.api.getEntry(id);
      if (generation !== this.generation || this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(
          outcome.code === 'ledger.conflict' ? 'bankWorkspace.entryMissing' : outcome.code,
        );
        this.state.set('error');
        return;
      }
      this.entry.set(outcome.result);
      this.state.set('ready');
    } catch {
      if (generation === this.generation && !this.destroyRef.destroyed) {
        this.error.set('ledger.error');
        this.state.set('error');
      }
    }
  }
  protected reverse(event: SubmitEvent): void {
    event.preventDefault();
    const entry = this.entry();
    if (
      this.busy() ||
      this.completed() ||
      this.state() !== 'ready' ||
      !entry ||
      entry.reversalId ||
      entry.reversesId
    )
      return;
    if (this.pending()) {
      void this.send(false);
      return;
    }
    this.reversalForm().markAsTouched();
    for (const field of ['reason', 'bookedOn'] as const)
      if (this.reversalForm[field]().invalid()) {
        this.reversalForm[field]().focusBoundControl();
        return;
      }
    void submit(this.reversalForm, async () => {
      const payload = { ...this.model(), reason: this.model().reason.trim() };
      const fingerprint = JSON.stringify(payload);
      if (this.requestKey?.fingerprint !== fingerprint)
        this.requestKey = { fingerprint, id: crypto.randomUUID() };
      this.pending.set({ ...payload, requestId: this.requestKey.id });
      await this.send();
    });
  }
  protected async refresh(): Promise<void> {
    if (this.pending()) return;
    if (await this.canDeactivate()) await this.load();
  }
  private async send(confirm = true): Promise<void> {
    const request = this.pending();
    const entry = this.entry();
    if (!request || !entry || this.busy()) return;
    this.busy.set(true);
    this.error.set(undefined);
    try {
      if (confirm && !(await this.confirmation.request(this.i18n.t('ledger.confirmReverse')))) {
        this.pending.set(undefined);
        return;
      }
      const outcome = await this.api.reverse(entry.id, request);
      if (this.destroyRef.destroyed) return;
      if (!outcome.success) {
        this.error.set(outcome.code);
        if (outcome.code !== 'ledger.error') this.pending.set(undefined);
        return;
      }
      this.completed.set(outcome.result);
      this.entry.set({ ...entry, reversalId: outcome.result.id });
      this.pending.set(undefined);
      this.reversalForm().reset();
    } catch {
      if (!this.destroyRef.destroyed) this.error.set('ledger.error');
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  protected invalid(field: 'reason' | 'bookedOn'): boolean {
    return this.reversalForm[field]().touched() && this.reversalForm[field]().invalid();
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  async canDeactivate(): Promise<boolean> {
    if (this.busy()) return false;
    if (this.completed()) return true;
    return (
      (!this.hasUnsavedChanges() && !this.pending()) ||
      this.confirmation.request(this.i18n.t('bankWorkspace.unsaved'))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || (!this.completed() && (this.hasUnsavedChanges() || this.pending())))
      event.preventDefault();
  }
}
import { Can } from '@backoffice/can';
