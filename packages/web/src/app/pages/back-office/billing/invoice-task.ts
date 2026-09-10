import {
  afterNextRender,
  afterRenderEffect,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { type DocumentIssueValue, type InvoiceDetailValue, Ulid } from '@froment/contracts';
import { Schema } from 'effect';
import { InvoicesApi } from '@backoffice/invoices-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Confirmation } from '@shared/confirmation/confirmation';
import { formatMoney } from '@froment/l10n';

interface TaskOutcome {
  readonly success: boolean;
  readonly code?: TranslationKey;
  readonly failure?: { readonly _tag: string; readonly issues?: ReadonlyArray<DocumentIssueValue> };
}

@Injectable()
export class InvoiceTask {
  readonly i18n = inject(I18nService);
  readonly api = inject(InvoicesApi);
  readonly route = inject(ActivatedRoute);
  readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly invoice = signal<InvoiceDetailValue | undefined>(undefined);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly completed = signal(false);
  readonly stale = signal(false);
  readonly uncertain = signal(false);
  readonly error = signal<TranslationKey | undefined>(undefined);
  readonly issues = signal<ReadonlyArray<DocumentIssueValue>>([]);
  private readonly focusRequested = signal(false);
  readonly locked = computed(
    () => this.loading() || this.busy() || this.completed() || this.stale() || this.uncertain(),
  );
  private request = 0;

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
    afterRenderEffect(() => {
      if (this.focusRequested()) {
        this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        this.focusRequested.set(false);
      } else if (this.completed() || this.error() || this.stale() || this.uncertain()) {
        this.element.nativeElement.querySelector<HTMLElement>('[data-task-feedback]')?.focus();
      }
    });
  }
  async load(): Promise<void> {
    if (this.busy() || this.uncertain()) return;
    const request = ++this.request;
    this.loading.set(true);
    this.invoice.set(undefined);
    this.error.set(undefined);
    this.stale.set(false);
    this.completed.set(false);
    const id = this.route.snapshot.paramMap.get('invoiceId');
    if (!Schema.is(Ulid)(id)) {
      this.error.set('invoice.not_found');
      this.loading.set(false);
      return;
    }
    try {
      const outcome = await this.api.get(id);
      if (this.destroyRef.destroyed || request !== this.request) return;
      if (outcome.success) this.invoice.set(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      if (!this.destroyRef.destroyed && request === this.request) this.error.set('invoice.error');
    } finally {
      if (request === this.request && !this.destroyRef.destroyed) this.loading.set(false);
    }
  }
  async run(operation: () => Promise<TaskOutcome>, confirm: TranslationKey): Promise<void> {
    if (this.busy() || this.loading() || this.completed() || this.stale()) return;
    this.busy.set(true);
    try {
      if (!(await this.confirmation.request(this.i18n.t(confirm)))) return;
      if (this.destroyRef.destroyed) return;
      this.error.set(undefined);
      this.issues.set([]);
      const outcome = await operation();
      if (this.destroyRef.destroyed) return;
      if (outcome.success) {
        this.completed.set(true);
        this.uncertain.set(false);
        return;
      }
      this.error.set(outcome.code ?? 'invoice.error');
      this.issues.set(outcome.failure?.issues ?? []);
      this.stale.set(
        outcome.code === 'invoice.version_conflict' ||
          outcome.code === 'invoice.credit_conflict' ||
          outcome.code === 'invoice.invalid_transition',
      );
      this.uncertain.set(outcome.code === 'invoice.error' || outcome.code === 'credit.error');
    } catch {
      if (!this.destroyRef.destroyed) {
        this.error.set('invoice.error');
        this.uncertain.set(true);
      }
    } finally {
      if (!this.destroyRef.destroyed) this.busy.set(false);
    }
  }
  async canDeactivate(dirty: boolean): Promise<boolean> {
    if (this.busy() || this.uncertain()) return false;
    if (this.completed()) return true;
    return (
      (!dirty && !this.uncertain()) ||
      this.confirmation.request(this.i18n.t('backOffice.invoice.unsavedChanges'))
    );
  }
  beforeUnload(event: BeforeUnloadEvent, dirty: boolean): void {
    if (!this.completed() && (dirty || this.busy() || this.uncertain())) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  focusInvalid(): void {
    this.focusRequested.set(true);
  }
  money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
