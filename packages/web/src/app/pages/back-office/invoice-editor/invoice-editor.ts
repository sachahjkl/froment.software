import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import {
  applyEach,
  applyWhen,
  disabled,
  FormField,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Ulid,
  type InvoiceCreateRequestValue,
  type InvoiceDetailValue,
  type InvoiceRevisionCreateRequestValue,
  type InvoiceStatusValue,
  type OrderListValue,
  type QuoteLineInputValue,
  type UlidValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { InvoicesApi, type InvoiceErrorCode } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';

interface InvoiceLineModel {
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly vatRate: string;
}

interface InvoiceModel {
  readonly orderId: string;
  readonly title: string;
  readonly serviceDate: string;
  readonly dueDate: string;
  readonly paymentTerms: string;
  readonly lines: Array<InvoiceLineModel>;
}

const emptyLine = (): InvoiceLineModel => ({
  description: '',
  quantity: '1.000',
  unitPrice: '0.00',
  vatRate: '20.00',
});

const statusKeys = {
  draft: 'backOffice.invoice.status.draft',
  issued: 'backOffice.invoice.status.issued',
  paid: 'backOffice.invoice.status.paid',
  void: 'backOffice.invoice.status.void',
} as const satisfies Record<InvoiceStatusValue, TranslationKey>;

const errorKeys = {
  'authentication.required': 'authentication.required',
  'authentication.permission_denied': 'authentication.permission_denied',
  'authentication.invalid_csrf': 'authentication.invalid_csrf',
  'request.rate_limited': 'request.rate_limited',
  'invoice.not_found': 'invoice.not_found',
  'invoice.order_not_found': 'invoice.order_not_found',
  'invoice.already_exists': 'invoice.already_exists',
  'invoice.not_editable': 'invoice.not_editable',
  'invoice.version_conflict': 'invoice.version_conflict',
  'invoice.amount_too_large': 'invoice.amount_too_large',
  'invoice.invalid_dates': 'invoice.invalid_dates',
  'invoice.invalid_transition': 'invoice.invalid_transition',
  'document.not_found': 'document.not_found',
  'invoice.error': 'invoice.error',
} as const satisfies Record<InvoiceErrorCode, TranslationKey>;

@Component({
  selector: 'app-invoice-editor',
  imports: [Button, FormField, RouterLink],
  templateUrl: './invoice-editor.html',
  styleUrl: './invoice-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceEditor {
  protected readonly i18n = inject(I18nService);
  private readonly invoicesApi = inject(InvoicesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly invoiceIdParameter = this.route.snapshot.paramMap.get('invoiceId');
  private readonly invoiceId = this.decodeId(this.invoiceIdParameter);
  protected readonly isNew = computed(() => this.invoiceIdParameter === null);
  protected readonly orders = signal<OrderListValue>([]);
  protected readonly detail = signal<InvoiceDetailValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionPending = signal(false);
  protected readonly pdfPendingVersion = signal<number | undefined>(undefined);
  protected readonly generatedPdfVersions = signal<ReadonlySet<number>>(new Set());
  protected readonly previewVersion = signal<number | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal<InvoiceModel>({
    orderId: '',
    title: '',
    serviceDate: '',
    dueDate: '',
    paymentTerms: '',
    lines: [emptyLine()],
  });
  protected readonly invoiceForm = form(this.model, (path) => {
    disabled(path, { when: () => !this.editable() });
    required(path.orderId, { when: () => this.isNew() });
    required(path.serviceDate);
    pattern(path.serviceDate, /^\d{4}-\d{2}-\d{2}$/);
    required(path.dueDate);
    pattern(path.dueDate, /^\d{4}-\d{2}-\d{2}$/);
    validate(path.dueDate, ({ value, valueOf }) =>
      value() < valueOf(path.serviceDate)
        ? { kind: 'dates', message: 'Due date precedes service date' }
        : undefined,
    );
    maxLength(path.paymentTerms, 2_000);
    applyWhen(
      path.title,
      () => !this.isNew(),
      (title) => {
        required(title);
        maxLength(title, 120);
        pattern(title, /\S/);
      },
    );
    applyWhen(
      path.lines,
      () => !this.isNew(),
      (lines) => {
        minLength(lines, 1);
        maxLength(lines, 20);
        applyEach(lines, (line) => {
          required(line.description);
          maxLength(line.description, 160);
          pattern(line.description, /\S/);
          pattern(line.quantity, /^\d+(?:[.,]\d{1,3})?$/);
          pattern(line.unitPrice, /^\d+(?:[.,]\d{1,2})?$/);
          pattern(line.vatRate, /^\d+(?:[.,]\d{1,2})?$/);
          validate(line.quantity, ({ value }) => {
            const parsed = parseFixedDecimal(value(), 3);
            return parsed === undefined || parsed === 0 ? { kind: 'quantity' } : undefined;
          });
          validate(line.unitPrice, ({ value }) =>
            parseFixedDecimal(value(), 2) === undefined ? { kind: 'unitPrice' } : undefined,
          );
          validate(line.vatRate, ({ value }) => {
            const parsed = parseFixedDecimal(value(), 2);
            return parsed === undefined || parsed > 10_000 ? { kind: 'vatRate' } : undefined;
          });
        });
      },
    );
  });
  protected readonly editable = computed(() => this.isNew() || this.detail()?.status === 'draft');
  protected readonly saveDisabled = computed(
    () =>
      this.loading() ||
      this.saving() ||
      !this.editable() ||
      this.invoiceForm().invalid() ||
      (!this.isNew() && !this.invoiceForm().dirty()),
  );
  protected readonly issueDisabled = computed(() => {
    const invoice = this.detail();
    return (
      invoice === undefined ||
      invoice.status !== 'draft' ||
      this.invoiceForm().dirty() ||
      this.saving() ||
      this.actionPending()
    );
  });
  protected readonly totalsAreStale = computed(
    () => this.detail() !== undefined && this.invoiceForm().dirty(),
  );
  protected readonly previewUrl = computed(() => {
    const version = this.previewVersion();
    return this.invoiceId === undefined || version === undefined
      ? undefined
      : `/api/invoices/${this.invoiceId}/revisions/${version}/preview`;
  });
  protected readonly previewFrameUrl = computed<SafeResourceUrl | undefined>(() => {
    const url = this.previewUrl();
    return url === undefined ? undefined : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected addLine(): void {
    if (!this.editable() || this.model().lines.length >= 20) return;
    this.model.update((model) => ({ ...model, lines: [...model.lines, emptyLine()] }));
    this.invoiceForm().markAsDirty();
  }

  protected removeLine(index: number): void {
    if (!this.editable() || this.model().lines.length === 1) return;
    this.model.update((model) => ({
      ...model,
      lines: model.lines.filter((_line, i) => i !== index),
    }));
    this.invoiceForm().markAsDirty();
  }

  canDeactivate(): boolean {
    return (
      !this.invoiceForm().dirty() ||
      globalThis.confirm(this.i18n.t('backOffice.invoice.unsavedChanges'))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.invoiceForm().dirty()) event.preventDefault();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.invoiceForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      const model = this.model();
      if (this.invoiceId === undefined) {
        const orderId = this.decodeId(model.orderId);
        if (orderId === undefined) {
          this.saving.set(false);
          return this.setError('invoice.order_not_found');
        }
        const request: InvoiceCreateRequestValue = {
          orderId,
          serviceDate: model.serviceDate,
          dueDate: model.dueDate,
          paymentTerms: model.paymentTerms,
        };
        const outcome = await this.invoicesApi.create(request);
        this.saving.set(false);
        if (!outcome.success) {
          if (outcome.failure?._tag === 'InvoiceAlreadyExists') {
            this.invoiceForm().reset();
            await this.router.navigate(['/backoffice/invoices', outcome.failure.invoiceId], {
              replaceUrl: true,
            });
            return;
          }
          return this.setError(outcome.code);
        }
        this.invoiceForm().reset();
        await this.router.navigate(['/backoffice/invoices', outcome.result.id], {
          replaceUrl: true,
        });
        return;
      }
      const current = this.detail();
      const lines = this.parseLines();
      if (current === undefined || lines === undefined) {
        this.saving.set(false);
        return this.setError('invoice.error');
      }
      const request: InvoiceRevisionCreateRequestValue = {
        expectedVersion: current.version,
        title: model.title.trim(),
        serviceDate: model.serviceDate,
        dueDate: model.dueDate,
        paymentTerms: model.paymentTerms,
        lines,
      };
      const outcome = await this.invoicesApi.createRevision(this.invoiceId, request);
      this.saving.set(false);
      if (!outcome.success) return this.setError(outcome.code);
      this.applyDetail(outcome.result);
    });
  }

  protected async issue(): Promise<void> {
    const invoice = this.detail();
    if (this.invoiceId === undefined || invoice === undefined || this.issueDisabled()) return;
    if (!globalThis.confirm(this.i18n.t('backOffice.invoice.issueConfirm'))) return;
    this.actionPending.set(true);
    this.error.set(undefined);
    const outcome = await this.invoicesApi.issue(this.invoiceId, invoice.version);
    this.actionPending.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    await this.reload();
  }

  protected async markPaid(): Promise<void> {
    await this.transition('paid');
  }

  protected async voidInvoice(): Promise<void> {
    await this.transition('void');
  }

  protected showPreview(version: number): void {
    this.previewVersion.set(version);
  }

  protected async generatePdf(version: number): Promise<void> {
    if (this.invoiceId === undefined) return;
    this.pdfPendingVersion.set(version);
    this.error.set(undefined);
    const outcome = await this.invoicesApi.renderPdf(this.invoiceId, version);
    this.pdfPendingVersion.set(undefined);
    if (!outcome.success) return this.setError(outcome.code);
    this.generatedPdfVersions.update((versions) => new Set([...versions, version]));
  }

  protected pdfUrl(version: number): string | undefined {
    return this.invoiceId === undefined || !this.generatedPdfVersions().has(version)
      ? undefined
      : `/api/invoices/${this.invoiceId}/revisions/${version}/pdf`;
  }

  protected money(cents: number): string {
    return new Intl.NumberFormat(this.i18n.language(), {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  protected date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected statusKey(status: InvoiceStatusValue): TranslationKey {
    return statusKeys[status];
  }

  private async load(): Promise<void> {
    if (this.invoiceIdParameter !== null && this.invoiceId === undefined) {
      this.setError('invoice.not_found');
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    try {
      if (this.invoiceId === undefined) {
        this.orders.set((await this.ordersApi.list()).filter((order) => order.invoiceId === null));
      } else {
        const outcome = await this.invoicesApi.get(this.invoiceId);
        if (!outcome.success) {
          this.setError(outcome.code);
          this.unavailable.set(true);
          return;
        }
        this.applyDetail(outcome.result);
      }
    } catch {
      this.setError('invoice.error');
      this.unavailable.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async reload(): Promise<void> {
    if (this.invoiceId === undefined) return;
    const outcome = await this.invoicesApi.get(this.invoiceId);
    if (!outcome.success) return this.setError(outcome.code);
    this.applyDetail(outcome.result);
  }

  private async transition(target: 'paid' | 'void'): Promise<void> {
    const invoice = this.detail();
    if (
      this.invoiceId === undefined ||
      invoice === undefined ||
      invoice.status !== 'issued' ||
      this.actionPending()
    )
      return;
    const confirmation =
      target === 'paid' ? 'backOffice.invoice.paidConfirm' : 'backOffice.invoice.voidConfirm';
    if (!globalThis.confirm(this.i18n.t(confirmation))) return;
    this.actionPending.set(true);
    this.error.set(undefined);
    const outcome =
      target === 'paid'
        ? await this.invoicesApi.markPaid(this.invoiceId, { expectedVersion: invoice.version })
        : await this.invoicesApi.void(this.invoiceId, { expectedVersion: invoice.version });
    this.actionPending.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.applyDetail(outcome.result);
  }

  private applyDetail(detail: InvoiceDetailValue): void {
    this.detail.set(detail);
    this.previewVersion.set(detail.version);
    this.model.set(this.modelFromDetail(detail));
    this.invoiceForm().reset();
  }

  private modelFromDetail(detail: InvoiceDetailValue): InvoiceModel {
    const separator = this.i18n.language() === 'fr' ? ',' : '.';
    const revision = detail.currentRevision;
    return {
      orderId: detail.orderId,
      title: revision.title,
      serviceDate: revision.serviceDate,
      dueDate: revision.dueDate,
      paymentTerms: revision.paymentTerms,
      lines: revision.lines.map((line) => ({
        description: line.description,
        quantity: formatFixedDecimal(line.quantityMilli, 3, separator),
        unitPrice: formatFixedDecimal(line.unitPriceCents, 2, separator),
        vatRate: formatFixedDecimal(line.vatRateBasisPoints, 2, separator),
      })),
    };
  }

  private parseLines(): ReadonlyArray<QuoteLineInputValue> | undefined {
    const result: Array<QuoteLineInputValue> = [];
    for (const line of this.model().lines) {
      const quantityMilli = parseFixedDecimal(line.quantity, 3);
      const unitPriceCents = parseFixedDecimal(line.unitPrice, 2);
      const vatRateBasisPoints = parseFixedDecimal(line.vatRate, 2);
      if (
        quantityMilli === undefined ||
        quantityMilli === 0 ||
        unitPriceCents === undefined ||
        vatRateBasisPoints === undefined ||
        vatRateBasisPoints > 10_000
      )
        return undefined;
      result.push({
        description: line.description.trim(),
        quantityMilli,
        unitPriceCents,
        vatRateBasisPoints,
      });
    }
    return result;
  }

  private decodeId(value: string | null): UlidValue | undefined {
    return value === null
      ? undefined
      : Option.getOrUndefined(Schema.decodeUnknownOption(Ulid)(value));
  }

  private setError(code: InvoiceErrorCode): void {
    this.error.set(errorKeys[code]);
  }
}
