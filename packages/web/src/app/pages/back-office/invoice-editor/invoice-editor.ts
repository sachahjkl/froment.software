import { Can } from '@backoffice/can';
import type { PermissionCodeValue } from '@froment/contracts';
import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CalendarDate,
  isDocumentText,
  Ulid,
  type InvoiceDetailValue,
  type InvoiceRevisionCreateRequestValue,
  type OrderListValue,
  type QuoteLineInputValue,
  type DocumentTextPresentationValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { InvoicesApi } from '@backoffice/invoices-api';
import { OrdersApi } from '@backoffice/orders-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { formatMoney } from '@froment/l10n';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Confirmation } from '@shared/confirmation/confirmation';
import { BillingNavigation } from '../billing/billing-navigation';
import { DocumentTextEditor } from '@shared/document-text-editor/document-text-editor';
import {
  DocumentLineEditor,
  type DocumentLineEditValue,
} from '@shared/document-line-editor/document-line-editor';

type InvoiceLineModel = DocumentLineEditValue;
const emptyLine = (): InvoiceLineModel => ({
  description: '',
  quantity: '1.000',
  unitPrice: '0.00',
  vatRate: '20.00',
});
interface InvoiceModel {
  refreshParties: boolean;
  orderId: string;
  title: string;
  serviceDate: string;
  dueDate: string;
  paymentTerms: string;
  paymentTermsPresentation?: DocumentTextPresentationValue;
  lines: InvoiceLineModel[];
}
const emptyModel = (): InvoiceModel => ({
  refreshParties: false,
  orderId: '',
  title: '',
  serviceDate: '',
  dueDate: '',
  paymentTerms: '',
  lines: [emptyLine()],
});

@Component({
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  selector: 'app-invoice-editor',
  imports: [
    Can,
    Button,
    FormField,
    Notice,
    PageHeader,
    RouterLink,
    DocumentTextEditor,
    DocumentLineEditor,
  ],
  templateUrl: './invoice-editor.html',
  styleUrl: './invoice-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceEditor {
  protected readonly writePermission = computed<PermissionCodeValue>(() =>
    this.isNew() ? 'invoice.create' : 'invoice.update',
  );
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(InvoicesApi);
  private readonly ordersApi = inject(OrdersApi);
  private readonly confirmation = inject(Confirmation);
  private readonly route = inject(ActivatedRoute);
  protected readonly navigation = new BillingNavigation(this.route);
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private request = 0;
  private readonly focusInvalid = signal(false);
  protected readonly isNew = signal(false);
  protected readonly titleKey = computed<TranslationKey>(() =>
    this.isNew() ? 'backOffice.invoice.title.new' : 'billingWorkspace.edit',
  );
  protected readonly saveKey = computed<TranslationKey>(() =>
    this.saving() ? 'backOffice.invoice.saving' : 'backOffice.invoice.save',
  );
  protected readonly orders = signal<OrderListValue>([]);
  protected readonly detail = signal<InvoiceDetailValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly unavailable = signal(false);
  protected readonly stale = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal(emptyModel());
  protected readonly paymentTermsPresentation = computed(
    () => this.model().paymentTermsPresentation,
  );
  private readonly baseline = signal(JSON.stringify(this.model()));
  protected readonly editable = computed(() => this.isNew() || this.detail()?.status === 'draft');
  protected readonly saveDisabled = computed(
    () =>
      !this.editable() ||
      this.saving() ||
      this.loading() ||
      this.stale() ||
      (this.isNew() && this.completed()),
  );
  protected readonly invoiceForm = form(this.model, (path) => {
    disabled(path, () => this.saveDisabled());
    required(path.orderId, { when: () => this.isNew() });
    required(path.serviceDate);
    validate(path.serviceDate, ({ value }) =>
      Schema.is(CalendarDate)(value()) ? undefined : { kind: 'date' },
    );
    required(path.dueDate);
    validate(path.dueDate, ({ value, valueOf }) =>
      !Schema.is(CalendarDate)(value()) || value() < valueOf(path.serviceDate)
        ? { kind: 'date' }
        : undefined,
    );
    maxLength(path.paymentTerms, 2000);
    validate(path.paymentTerms, ({ value }) =>
      !isDocumentText(value(), this.model().paymentTermsPresentation?.format ?? 'plain')
        ? { kind: 'format' }
        : undefined,
    );
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
          validate(line.quantity, ({ value }) => {
            const parsed = parseFixedDecimal(value(), 3);
            return parsed === undefined || parsed === 0 ? { kind: 'quantity' } : undefined;
          });
          validate(line.unitPrice, ({ value }) =>
            parseFixedDecimal(value(), 2) === undefined ? { kind: 'unitPrice' } : undefined,
          );
          validate(line.vatRate, ({ value }) => {
            const parsed = parseFixedDecimal(value(), 2);
            return parsed === undefined || parsed > 10000 ? { kind: 'vatRate' } : undefined;
          });
        });
      },
    );
  });
  // Les animations de validité des dates peuvent marquer des valeurs inchangées comme dirty.
  // Comparez les valeurs chargées. Conservez aussi les saisies natives incomplètes et les conflits.
  protected readonly hasUnsavedChanges = computed(
    () =>
      this.stale() ||
      JSON.stringify(this.model()) !== this.baseline() ||
      this.invoiceForm()
        .errorSummary()
        .some((error) => error.kind === 'parse'),
  );
  protected readonly totalsAreStale = computed(
    () => this.detail() !== undefined && this.hasUnsavedChanges(),
  );
  protected readonly lineTotals = computed(() =>
    this.totalsAreStale()
      ? []
      : (this.detail()?.currentRevision.lines.map((line) => line.totalCents) ?? []),
  );

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => void this.load(params.get('invoiceId'))),
    );
    afterRenderEffect(() => {
      if (this.focusInvalid()) {
        this.element.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        this.focusInvalid.set(false);
      } else if (this.error() || this.completed())
        this.element.nativeElement.querySelector<HTMLElement>('[data-editor-feedback]')?.focus();
    });
  }
  protected setLines(lines: ReadonlyArray<DocumentLineEditValue>): void {
    if (this.saveDisabled()) return;
    this.model.update((model) => ({ ...model, lines: [...lines] }));
    this.invoiceForm().markAsDirty();
    this.completed.set(false);
  }
  async canDeactivate(): Promise<boolean> {
    if (this.completed() && !this.hasUnsavedChanges()) return true;
    if (this.saving()) return false;
    return (
      !this.hasUnsavedChanges() ||
      this.confirmation.request(this.i18n.t('backOffice.invoice.unsavedChanges'))
    );
  }

  protected setPaymentTermsPresentation(
    paymentTermsPresentation: DocumentTextPresentationValue,
  ): void {
    if (this.invoiceForm.paymentTerms().disabled()) return;
    this.model.update((model) => ({ ...model, paymentTermsPresentation }));
    this.invoiceForm.paymentTerms().markAsDirty();
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
  protected save(event: Event): void {
    event.preventDefault();
    if (this.saveDisabled() || (this.completed() && !this.hasUnsavedChanges())) return;
    void submit(this.invoiceForm, {
      action: async () => {
        if (!this.isNew() && !this.hasUnsavedChanges()) return;
        this.saving.set(true);
        this.error.set(undefined);
        this.completed.set(false);
        try {
          const model = this.model();
          const detail = this.detail();
          if (this.isNew()) {
            if (!Schema.is(Ulid)(model.orderId)) {
              this.error.set('invoice.order_not_found');
              return;
            }
            const values = {
              orderId: model.orderId,
              serviceDate: model.serviceDate,
              dueDate: model.dueDate,
              paymentTerms: model.paymentTerms,
            };
            const request =
              model.paymentTermsPresentation === undefined
                ? values
                : { ...values, paymentTermsPresentation: model.paymentTermsPresentation };
            const outcome = await this.api.create(request);
            if (this.destroyRef.destroyed) return;
            if (!outcome.success) {
              if (outcome.failure?._tag === 'InvoiceAlreadyExists') {
                this.resetForm();
                this.completed.set(true);
                await this.router.navigate(['/backoffice/invoices', outcome.failure.invoiceId], {
                  replaceUrl: true,
                  queryParams: this.navigation.detailQuery(),
                });
                return;
              }
              this.error.set(outcome.code);
              return;
            }
            this.resetForm();
            this.completed.set(true);
            await this.router.navigate(['/backoffice/invoices', outcome.result.id], {
              replaceUrl: true,
              queryParams: this.navigation.detailQuery(),
            });
            return;
          }
          const lines = this.parseLines();
          if (!detail || !lines) {
            this.error.set('invoice.error');
            return;
          }
          const values: InvoiceRevisionCreateRequestValue = {
            expectedVersion: detail.version,
            refreshParties: model.refreshParties,
            title: model.title.trim(),
            serviceDate: model.serviceDate,
            dueDate: model.dueDate,
            paymentTerms: model.paymentTerms,
            lines,
          };
          const request =
            model.paymentTermsPresentation === undefined
              ? values
              : { ...values, paymentTermsPresentation: model.paymentTermsPresentation };
          const outcome = await this.api.createRevision(detail.id, request);
          if (this.destroyRef.destroyed) return;
          if (!outcome.success) {
            this.error.set(outcome.code);
            this.stale.set(
              outcome.code === 'invoice.version_conflict' ||
                outcome.code === 'invoice.not_editable',
            );
            return;
          }
          this.applyDetail(outcome.result);
          this.completed.set(true);
        } catch {
          if (!this.destroyRef.destroyed) this.error.set('invoice.error');
        } finally {
          if (!this.destroyRef.destroyed) this.saving.set(false);
        }
      },
      onInvalid: () => this.focusInvalid.set(true),
    });
  }
  protected async reload(): Promise<void> {
    if (this.saving()) return;
    if (
      this.hasUnsavedChanges() &&
      !(await this.confirmation.request(this.i18n.t('billingWorkspace.reloadConfirm')))
    )
      return;
    await this.load(this.route.snapshot.paramMap.get('invoiceId'));
  }
  private async load(parameter: string | null): Promise<void> {
    const request = ++this.request;
    this.isNew.set(parameter === null);
    this.detail.set(undefined);
    this.loading.set(true);
    this.unavailable.set(false);
    this.error.set(undefined);
    this.stale.set(false);
    this.completed.set(false);
    this.model.set(emptyModel());
    this.resetForm();
    if (parameter !== null && !Schema.is(Ulid)(parameter)) {
      this.unavailable.set(true);
      this.error.set('invoice.not_found');
      this.loading.set(false);
      return;
    }
    try {
      if (parameter === null) {
        const orders = await this.ordersApi.list();
        if (request !== this.request || this.destroyRef.destroyed) return;
        this.orders.set(orders.filter((order) => order.invoiceId === null));
        const selected = this.route.snapshot.queryParamMap.get('orderId');
        if (selected && this.orders().some((order) => order.id === selected))
          this.model.update((model) => ({ ...model, orderId: selected }));
        this.resetForm();
      } else {
        const outcome = await this.api.get(parameter);
        if (request !== this.request || this.destroyRef.destroyed) return;
        if (!outcome.success) {
          this.error.set(outcome.code);
          this.unavailable.set(true);
          return;
        }
        this.applyDetail(outcome.result);
      }
    } catch {
      if (request === this.request && !this.destroyRef.destroyed) {
        this.error.set('invoice.error');
        this.unavailable.set(true);
      }
    } finally {
      if (request === this.request && !this.destroyRef.destroyed) this.loading.set(false);
    }
  }
  private applyDetail(detail: InvoiceDetailValue): void {
    this.detail.set(detail);
    const revision = detail.currentRevision;
    const separator = this.i18n.language() === 'fr' ? ',' : '.';
    this.model.set({
      orderId: detail.orderId,
      refreshParties: false,
      title: revision.title,
      serviceDate: revision.serviceDate,
      dueDate: revision.dueDate,
      paymentTerms: revision.paymentTerms,
      paymentTermsPresentation: revision.paymentTermsPresentation,
      lines: revision.lines.map((line) => ({
        description: line.description,
        quantity: formatFixedDecimal(line.quantityMilli, 3, separator),
        unitPrice: formatFixedDecimal(line.unitPriceCents, 2, separator),
        vatRate: formatFixedDecimal(line.vatRateBasisPoints, 2, separator),
      })),
    });
    this.resetForm();
  }
  private resetForm(): void {
    this.baseline.set(JSON.stringify(this.model()));
    this.invoiceForm().reset();
  }
  private parseLines(): ReadonlyArray<QuoteLineInputValue> | undefined {
    const result: QuoteLineInputValue[] = [];
    for (const line of this.model().lines) {
      const quantityMilli = parseFixedDecimal(line.quantity, 3);
      const unitPriceCents = parseFixedDecimal(line.unitPrice, 2);
      const vatRateBasisPoints = parseFixedDecimal(line.vatRate, 2);
      if (
        quantityMilli === undefined ||
        quantityMilli === 0 ||
        unitPriceCents === undefined ||
        vatRateBasisPoints === undefined ||
        vatRateBasisPoints > 10000
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
  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), 'EUR');
  }
}
