import { Authentication } from '@backoffice/authentication';
import { Can } from '@backoffice/can';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { type AuditEventValue } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { OrdersApi } from '@backoffice/orders-api';
import { Button } from '@shared/button/button';
import { Badge } from '@shared/badge/badge';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { DocumentTextView } from '@shared/document-text-view/document-text-view';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { InvoiceTask } from '../billing/invoice-task';
import { activePaidCents, detailBalance, paymentMethodKey } from '../billing/billing-state';
import {
  commercialDocumentTitle,
  invoiceFinancialBadge,
  invoiceStatusBadge,
} from '../commercial-header';
import { canCancelPayment } from '../billing/receipt-cancellation';
import { invoiceActions, recordedEntryStatus } from './invoice-actions';
import { ClientDescription } from '../client-description/client-description';

@Component({
  selector: 'app-invoice-detail',
  imports: [
    Can,
    Button,
    Badge,
    ClientDescription,
    DataTable,
    Notice,
    PageHeader,
    DocumentTextView,
    RouterLink,
    FormField,
    LocalizedDatePipe,
    Tabs,
  ],
  providers: [InvoiceTask],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container' },
})
export class InvoiceDetail {
  private readonly authentication = inject(Authentication);
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  private readonly creditsApi = inject(InvoiceCreditsApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = toSignal(this.task.route.queryParamMap, {
    initialValue: this.task.route.snapshot.queryParamMap,
  });
  private readonly sections = [
    { value: 'summary', label: 'billingWorkspace.summary' },
    { value: 'document', label: 'billingWorkspace.document' },
    { value: 'receipts', label: 'billingWorkspace.receipts' },
    { value: 'credit', label: 'credit.title' },
    { value: 'history', label: 'billingWorkspace.history' },
  ] as const;
  protected readonly tab = computed(
    () =>
      this.sections.find(
        (section) =>
          this.sectionAllowed(section.value) && section.value === this.query().get('tab'),
      )?.value ?? 'summary',
  );
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    this.sections
      .filter((section) => this.sectionAllowed(section.value))
      .map((section) => ({
        path: '.',
        id: `invoice-${section.value}-tab`,
        label: this.i18n.t(section.label),
        queryParams: { tab: section.value },
        active: this.tab() === section.value,
      })),
  );
  private sectionAllowed(section: (typeof this.sections)[number]['value']): boolean {
    if (section === 'history') return this.authentication.can('audit.read');
    if (section === 'receipts') return this.authentication.can('payment.read');
    return true;
  }
  protected readonly headerTitle = computed(() => {
    const invoice = this.task.invoice();
    return invoice
      ? commercialDocumentTitle(invoice.invoiceNumber, invoice.currentRevision.title)
      : this.i18n.t('billingWorkspace.invoices');
  });
  protected readonly statusBadge = computed(() => {
    const invoice = this.task.invoice();
    return invoice ? invoiceStatusBadge(invoice.status) : undefined;
  });
  protected readonly actions = computed(() => invoiceActions(this.task.invoice()));
  protected readonly canCancelPayment = canCancelPayment;
  protected readonly recordedEntryStatus = recordedEntryStatus;
  protected readonly paymentMethodKey = paymentMethodKey;
  protected readonly paid = computed(() => {
    const invoice = this.task.invoice();
    return invoice ? activePaidCents(invoice) : 0;
  });
  protected readonly balance = computed(() => {
    const invoice = this.task.invoice();
    return invoice ? detailBalance(invoice) : 0;
  });
  protected readonly financialBadge = computed(() => {
    const invoice = this.task.invoice();
    return invoice ? invoiceFinancialBadge(invoice) : undefined;
  });
  protected readonly history = resource({
    params: () => (this.tab() === 'history' ? this.task.invoice()?.id : undefined),
    loader: ({ params }) => this.task.api.history(params),
  });
  protected readonly events = computed(() => {
    const result = this.history.hasValue() ? this.history.value() : undefined;
    return result?.success ? result.result : undefined;
  });
  protected readonly historyError = computed<TranslationKey>(() => {
    const result = this.history.hasValue() ? this.history.value() : undefined;
    return result && !result.success && result.code === 'invoice.workspace_limit'
      ? 'billingWorkspace.limitExceeded'
      : 'billingWorkspace.loadError';
  });
  protected readonly receiptCreditsRequired = computed(() => {
    const invoice = this.task.invoice();
    return (
      this.tab() === 'receipts' &&
      invoice !== undefined &&
      (invoice.status === 'issued' || invoice.status === 'paid') &&
      invoice.payments.some((payment) => payment.cancelledAt === null)
    );
  });
  protected readonly credits = resource({
    params: () => {
      const invoice = this.task.invoice();
      if (!invoice || (this.tab() !== 'credit' && !this.receiptCreditsRequired())) return undefined;
      return { invoiceId: invoice.id, version: invoice.version };
    },
    loader: ({ params }) => this.creditsApi.get(params.invoiceId),
  });
  protected readonly creditState = computed(() => {
    if (this.credits.isLoading()) return undefined;
    const result = this.credits.hasValue() ? this.credits.value() : undefined;
    return result?.success ? result.result : undefined;
  });
  protected readonly orders = resource({
    params: () =>
      this.authentication.can('order.read') && this.tab() === 'summary'
        ? this.task.invoice()?.orderId
        : undefined,
    loader: () => this.ordersApi.list(),
  });
  protected readonly order = computed(() =>
    this.orders.hasValue()
      ? this.orders.value().find((order) => order.id === this.task.invoice()?.orderId)
      : undefined,
  );
  private readonly version = linkedSignal(() => String(this.task.invoice()?.version ?? ''));
  protected readonly versionForm = form(this.version);
  protected readonly revision = computed(() =>
    this.task.invoice()?.revisions.find((revision) => String(revision.version) === this.version()),
  );
  protected readonly previewUrl = computed(() => {
    const invoice = this.task.invoice();
    const revision = this.revision();
    return !this.authentication.can('document.render') || !invoice || !revision
      ? undefined
      : `/api/invoices/${invoice.id}/revisions/${revision.version}/preview`;
  });
  protected readonly preview = computed(() => {
    const url = this.previewUrl();
    return url === undefined ? undefined : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  protected readonly generated = signal<ReadonlySet<string>>(new Set());
  protected readonly pdfPending = signal(false);
  protected readonly reloadDisabled = computed(() => this.task.loading() || this.pdfPending());
  protected readonly generateLabel = computed(() =>
    this.i18n.t(
      this.pdfPending() ? 'backOffice.invoice.pdf.generating' : 'backOffice.invoice.pdf.generate',
    ),
  );
  protected readonly pdfProcessing = computed(() => {
    const status = this.task.invoice()?.pdf?.status;
    return status === 'pending' || status === 'processing';
  });
  protected readonly pdfUrl = computed(() => {
    const invoice = this.task.invoice();
    const revision = this.revision();
    if (!this.authentication.can('document.download') || !invoice || !revision) return undefined;
    return (revision.version === invoice.version && invoice.pdf?.status === 'ready') ||
      this.generated().has(revision.id)
      ? `/api/invoices/${invoice.id}/revisions/${revision.version}/pdf`
      : undefined;
  });
  protected async generatePdf(): Promise<void> {
    const invoice = this.task.invoice();
    const revision = this.revision();
    if (!invoice || !revision || revision.invoiceNumber === null || this.pdfPending()) return;
    this.pdfPending.set(true);
    this.task.error.set(undefined);
    try {
      const result = await this.task.api.renderPdf(invoice.id, revision.version);
      if (this.destroyRef.destroyed || this.task.invoice()?.id !== invoice.id) return;
      if (!result.success) this.task.error.set(result.code);
      else this.generated.update((values) => new Set([...values, revision.id]));
    } catch {
      if (!this.destroyRef.destroyed) this.task.error.set('invoice.error');
    } finally {
      if (!this.destroyRef.destroyed) this.pdfPending.set(false);
    }
  }
  protected metadata(event: AuditEventValue): ReadonlyArray<readonly [string, string]> {
    return Object.entries(event.metadata);
  }
  protected eventLabel(event: AuditEventValue): string {
    switch (event.action) {
      case 'document.rendered':
        return this.i18n.t('billingWorkspace.pdfRecorded');
      case 'invoice.created':
        return this.i18n.t('billingWorkspace.created');
      case 'invoice.revised':
        return this.i18n.t('billingWorkspace.revised');
      case 'invoice.issued':
        return this.i18n.t('billingWorkspace.issued');
      case 'invoice.voided':
        return this.i18n.t('billingWorkspace.voided');
      case 'invoice.payment-recorded':
        return this.i18n.t('billingWorkspace.paymentRecorded');
      case 'invoice.payment-cancelled':
        return this.i18n.t('billingWorkspace.paymentCancelled');
      case 'invoice.credited':
        return this.i18n.t('billingWorkspace.creditIssued');
      case 'invoice.refund-recorded':
        return this.i18n.t('billingWorkspace.refundRecorded');
      case 'invoice.refund-cancelled':
        return this.i18n.t('billingWorkspace.refundCancelled');
      default:
        return event.action;
    }
  }
}
