import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { DetailRow } from '@shared/detail-row/detail-row';
import { Notice } from '@shared/notice/notice';
import { OutcomePanel } from '@shared/outcome-panel/outcome-panel';
import { Icon } from '@shared/icon/icon';

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
  imports: [Button, DetailRow, FormField, Icon, Notice, OutcomePanel, RouterLink],
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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly invoiceId = signal<UlidValue | undefined>(undefined);
  private routeRequest = 0;
  protected readonly isNew = signal(false);
  protected readonly orders = signal<OrderListValue>([]);
  protected readonly detail = signal<InvoiceDetailValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly actionPending = signal(false);
  protected readonly pdfPendingVersion = signal<number | undefined>(undefined);
  protected readonly generatedPdfVersions = signal<ReadonlySet<number>>(new Set());
  protected readonly previewVersion = signal<number | undefined>(undefined);
  protected readonly previewUrl = computed(() => {
    const invoiceId = this.invoiceId();
    const version = this.previewVersion();
    return invoiceId === undefined || version === undefined
      ? undefined
      : `/api/invoices/${invoiceId}/revisions/${version}/preview`;
  });
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
        ? { kind: 'dates', message: 'due_date_precedes_service_date' }
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
    () => !this.editable() || this.saving() || this.actionPending(),
  );
  protected readonly issueDisabled = computed(
    () => this.saving() || this.actionPending() || this.invoiceForm().dirty(),
  );
  protected readonly totalsAreStale = computed(
    () => this.detail() !== undefined && this.invoiceForm().dirty(),
  );
  protected readonly previewFrameUrl = computed<SafeResourceUrl | undefined>(() => {
    const url = this.previewUrl();
    return url === undefined ? undefined : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    afterNextRender(() => {
      this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        void this.load(params.get('invoiceId'));
      });
    });
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
    void submit(this.invoiceForm, {
      action: async () => {
        this.saving.set(true);
        this.error.set(undefined);
        try {
          const model = this.model();
          const invoiceId = this.invoiceId();
          if (invoiceId === undefined) {
            const orderId = this.decodeId(model.orderId);
            if (orderId === undefined) return this.setError('invoice.order_not_found');
            const request: InvoiceCreateRequestValue = {
              orderId,
              serviceDate: model.serviceDate,
              dueDate: model.dueDate,
              paymentTerms: model.paymentTerms,
            };
            const outcome = await this.invoicesApi.create(request);
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
          if (current === undefined || lines === undefined) return this.setError('invoice.error');
          const request: InvoiceRevisionCreateRequestValue = {
            expectedVersion: current.version,
            title: model.title.trim(),
            serviceDate: model.serviceDate,
            dueDate: model.dueDate,
            paymentTerms: model.paymentTerms,
            lines,
          };
          const outcome = await this.invoicesApi.createRevision(invoiceId, request);
          if (!outcome.success) return this.setError(outcome.code);
          this.applyDetail(outcome.result);
        } catch {
          this.setError('invoice.error');
        } finally {
          this.saving.set(false);
        }
      },
      onInvalid: () => this.focusFirstInvalid(),
    });
  }

  protected async issue(): Promise<void> {
    const invoice = this.detail();
    if (
      this.invoiceId() === undefined ||
      invoice === undefined ||
      invoice.status !== 'draft' ||
      this.invoiceForm().dirty() ||
      this.issueDisabled()
    )
      return;
    if (!globalThis.confirm(this.i18n.t('backOffice.invoice.issueConfirm'))) return;
    this.actionPending.set(true);
    this.error.set(undefined);
    try {
      const outcome = await this.invoicesApi.issue(this.invoiceId()!, invoice.version);
      if (!outcome.success) return this.setError(outcome.code);
      await this.reload();
    } catch {
      this.setError('invoice.error');
    } finally {
      this.actionPending.set(false);
    }
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
    const invoiceId = this.invoiceId();
    if (invoiceId === undefined) return;
    this.pdfPendingVersion.set(version);
    this.error.set(undefined);
    try {
      const outcome = await this.invoicesApi.renderPdf(invoiceId, version);
      if (!outcome.success) return this.setError(outcome.code);
      this.generatedPdfVersions.update((versions) => new Set([...versions, version]));
    } catch {
      this.setError('invoice.error');
    } finally {
      this.pdfPendingVersion.set(undefined);
    }
  }

  protected pdfUrl(version: number): string | undefined {
    const invoiceId = this.invoiceId();
    return invoiceId === undefined || !this.generatedPdfVersions().has(version)
      ? undefined
      : `/api/invoices/${invoiceId}/revisions/${version}/pdf`;
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

  private async load(parameter: string | null): Promise<void> {
    const request = ++this.routeRequest;
    const invoiceId = this.decodeId(parameter);
    this.invoiceId.set(invoiceId);
    this.isNew.set(parameter === null);
    this.detail.set(undefined);
    this.orders.set([]);
    this.previewVersion.set(undefined);
    this.pdfPendingVersion.set(undefined);
    this.generatedPdfVersions.set(new Set());
    this.error.set(undefined);
    this.unavailable.set(false);
    this.loading.set(true);
    this.model.set({
      orderId: '',
      title: '',
      serviceDate: '',
      dueDate: '',
      paymentTerms: '',
      lines: [emptyLine()],
    });
    this.invoiceForm().reset();
    if (parameter !== null && invoiceId === undefined) {
      this.setError('invoice.not_found');
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    try {
      if (invoiceId === undefined) {
        const orders = await this.ordersApi.list();
        if (request !== this.routeRequest) return;
        this.orders.set(orders.filter((order) => order.invoiceId === null));
      } else {
        const outcome = await this.invoicesApi.get(invoiceId);
        if (request !== this.routeRequest) return;
        if (!outcome.success) {
          this.setError(outcome.code);
          this.unavailable.set(true);
          return;
        }
        this.applyDetail(outcome.result);
      }
    } catch {
      if (request !== this.routeRequest) return;
      this.setError('invoice.error');
      this.unavailable.set(true);
    } finally {
      if (request === this.routeRequest) this.loading.set(false);
    }
  }

  private async reload(): Promise<void> {
    const invoiceId = this.invoiceId();
    if (invoiceId === undefined) return;
    const outcome = await this.invoicesApi.get(invoiceId);
    if (!outcome.success) return this.setError(outcome.code);
    this.applyDetail(outcome.result);
  }

  private async transition(target: 'paid' | 'void'): Promise<void> {
    const invoice = this.detail();
    if (
      this.invoiceId() === undefined ||
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
    try {
      const outcome =
        target === 'paid'
          ? await this.invoicesApi.markPaid(this.invoiceId()!, { expectedVersion: invoice.version })
          : await this.invoicesApi.void(this.invoiceId()!, { expectedVersion: invoice.version });
      if (!outcome.success) return this.setError(outcome.code);
      this.applyDetail(outcome.result);
    } catch {
      this.setError('invoice.error');
    } finally {
      this.actionPending.set(false);
    }
  }

  private applyDetail(detail: InvoiceDetailValue): void {
    this.detail.set(detail);
    this.showPreview(detail.version);
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

  private focusFirstInvalid(): void {
    let errorId: string | undefined;
    if (this.invoiceForm.orderId().invalid()) errorId = 'invoice-order-error';
    else if (this.invoiceForm.title().invalid()) errorId = 'invoice-title-error';
    else if (this.invoiceForm.serviceDate().invalid()) errorId = 'invoice-service-date-error';
    else if (this.invoiceForm.dueDate().invalid()) errorId = 'invoice-due-date-error';
    else {
      for (let index = 0; index < this.invoiceForm.lines.length; index++) {
        const line = this.invoiceForm.lines[index]!;
        if (line.description().invalid()) errorId = `invoice-line-description-error-${index}`;
        else if (line.quantity().invalid()) errorId = `invoice-line-quantity-error-${index}`;
        else if (line.unitPrice().invalid()) errorId = `invoice-line-price-error-${index}`;
        else if (line.vatRate().invalid()) errorId = `invoice-line-vat-error-${index}`;
        if (errorId !== undefined) break;
      }
    }
    if (errorId === undefined) return;
    this.element.nativeElement
      .querySelector<HTMLElement>(`[aria-describedby="${errorId}"]`)
      ?.focus();
  }

  private setError(code: InvoiceErrorCode): void {
    this.error.set(errorKeys[code]);
  }
}
