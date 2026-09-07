import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CreditNoteRequest,
  InvoiceCredits,
  InvoiceRefundRequest,
  type InvoiceDetailValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { formatMoney } from '@froment/l10n';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  selector: 'app-credit-notes',
  imports: [FormField, Button, Notice, RouterLink, LocalizedDatePipe],
  templateUrl: './credit-notes.html',
  styleUrl: './credit-notes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class CreditNotes {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoiceCreditsApi);
  private readonly invoices = inject(InvoicesApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('invoiceId') ?? '';
  private readonly result = viewChild<ElementRef<HTMLElement>>('result');
  protected readonly invoice = signal<InvoiceDetailValue | undefined>(undefined);
  protected readonly state = signal<typeof InvoiceCredits.Type | undefined>(undefined);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saved = signal(false);
  private creditId: string | undefined;
  private refundId: string | undefined;
  protected readonly creditForm = form(signal({ reason: '' }), (path) => {
    required(path.reason);
    disabled(path, () => this.busy() || this.loading());
  });
  protected readonly refundForm = form(signal({ amount: '', date: '', reference: '' }), (path) => {
    required(path.amount);
    required(path.date);
    required(path.reference);
    disabled(path, () => this.busy() || this.loading());
  });
  protected readonly cancelForm = form(signal({ reason: '' }), (path) => {
    disabled(path, () => this.busy() || this.loading());
  });
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  protected async load(): Promise<void> {
    this.loading.set(true);
    const [invoice, credits] = await Promise.all([
      this.invoices.get(this.id),
      this.api.get(this.id),
    ]);
    if (invoice.success && credits.success) {
      this.invoice.set(invoice.result);
      this.state.set(credits.result);
      this.error.set(undefined);
    } else this.error.set('credit.error');
    this.loading.set(false);
  }
  protected async issue(event: Event): Promise<void> {
    event.preventDefault();
    const invoice = this.invoice();
    if (this.busy() || this.loading() || invoice === undefined) return;
    this.creditId ??= crypto.randomUUID();
    const request = Schema.decodeUnknownOption(CreditNoteRequest)({
      requestId: this.creditId,
      expectedVersion: invoice.version,
      reason: this.creditForm().value().reason,
    });
    if (Option.isNone(request)) {
      this.error.set('invoice.credit_conflict');
      return;
    }
    if (!(await this.confirmation.request(this.i18n.t('credit.confirmIssue')))) return;
    this.busy.set(true);
    try {
      const outcome = await this.api.issue(this.id, request.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.state.set(outcome.result);
      this.creditForm().reset({ reason: '' });
      this.creditId = undefined;
      this.complete();
    } finally {
      this.busy.set(false);
    }
  }
  protected async refund(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.loading()) return;
    this.refundId ??= crypto.randomUUID();
    const model = this.refundForm().value();
    const request = Schema.decodeUnknownOption(InvoiceRefundRequest)({
      requestId: this.refundId,
      amountCents: parseFixedDecimal(model.amount, 2),
      refundedOn: model.date,
      reference: model.reference,
    });
    if (Option.isNone(request)) {
      this.error.set('invoice.credit_conflict');
      return;
    }
    if (!(await this.confirmation.request(this.i18n.t('credit.confirmRefund')))) return;
    this.busy.set(true);
    try {
      const outcome = await this.api.refund(this.id, request.value);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.state.set(outcome.result);
      this.refundForm().reset({ amount: '', date: '', reference: '' });
      this.refundId = undefined;
      this.complete();
    } finally {
      this.busy.set(false);
    }
  }
  protected async cancel(id: string): Promise<void> {
    const reason = this.cancelForm().value().reason.trim();
    if (
      this.busy() ||
      reason === '' ||
      !(await this.confirmation.request(this.i18n.t('credit.confirmCancel')))
    )
      return;
    this.busy.set(true);
    try {
      const outcome = await this.api.cancel(this.id, id, reason);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.state.set(outcome.result);
      this.cancelForm().reset({ reason: '' });
      this.complete();
    } finally {
      this.busy.set(false);
    }
  }
  private complete(): void {
    this.error.set(undefined);
    this.saved.set(true);
    this.result()?.nativeElement.focus();
  }
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.busy()) return false;
    return (
      !this.dirty() || this.confirmation.request(this.i18n.t('backOffice.invoice.unsavedChanges'))
    );
  }
  private dirty(): boolean {
    return this.creditForm().dirty() || this.refundForm().dirty() || this.cancelForm().dirty();
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.dirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
