import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  applyEach,
  form,
  FormField,
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
  SupplierInvoiceLineInput,
  type SupplierInvoice,
  type SupplierInvoiceLineInput as SupplierInvoiceLineInputValue,
} from '@froment/contracts';
import { Schema } from 'effect';

import { parseFixedDecimal, formatFixedDecimal } from '@backoffice/quote-input';
import { SupplierInvoicesApi } from '@backoffice/supplier-invoices-api';
import { SuppliersApi } from '@backoffice/suppliers-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Breadcrumbs } from '@shared/breadcrumbs/breadcrumbs';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

interface LineModel {
  readonly description: string;
  readonly netAmount: string;
  readonly vatRate: string;
}
interface Model {
  readonly supplierId: string;
  readonly reference: string;
  readonly invoiceDate: string;
  readonly dueDate: string;
  readonly currency: string;
  readonly notes: string;
  readonly lines: ReadonlyArray<LineModel>;
}
const emptyLine = (): LineModel => ({ description: '', netAmount: '', vatRate: '20.00' });
const emptyModel = (): Model => ({
  supplierId: '',
  reference: '',
  invoiceDate: '',
  dueDate: '',
  currency: 'EUR',
  notes: '',
  lines: [emptyLine()],
});

@Component({
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  selector: 'app-supplier-invoice-editor',
  imports: [Breadcrumbs, Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './supplier-invoice-editor.html',
  styleUrl: './supplier-invoice-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierInvoiceEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SupplierInvoicesApi);
  private readonly suppliersApi = inject(SuppliersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(Confirmation);
  private readonly requestId = crypto.randomUUID();
  private readonly invoiceId = this.route.snapshot.paramMap.get('invoiceId');
  private readonly invoice = signal<SupplierInvoice | undefined>(undefined);
  protected readonly editing = this.invoiceId !== null;
  protected readonly suppliers = signal<Awaited<ReturnType<SuppliersApi['list']>>>([]);
  protected readonly model = signal<Model>(emptyModel());
  protected readonly invoiceForm = form(this.model, (path) => {
    required(path.supplierId);
    required(path.reference);
    pattern(path.reference, /\S/);
    maxLength(path.reference, 80);
    required(path.invoiceDate);
    validate(path.invoiceDate, ({ value }) =>
      Schema.is(CalendarDate)(value()) ? undefined : { kind: 'date' },
    );
    required(path.dueDate);
    validate(path.dueDate, ({ value, valueOf }) =>
      !Schema.is(CalendarDate)(value()) || value() < valueOf(path.invoiceDate)
        ? { kind: 'date' }
        : undefined,
    );
    required(path.currency);
    pattern(path.currency, /^[A-Z]{3}$/);
    maxLength(path.notes, 4_000);
    minLength(path.lines, 1);
    applyEach(path.lines, (line) => {
      required(line.description);
      pattern(line.description, /\S/);
      maxLength(line.description, 500);
      validate(line.netAmount, ({ value }) => {
        const amount = parseFixedDecimal(value(), 2);
        return amount === undefined || amount < 0 || amount > 4_000_000_000_000
          ? { kind: 'amount' }
          : undefined;
      });
      validate(line.vatRate, ({ value }) => {
        const rate = parseFixedDecimal(value(), 2);
        return rate === undefined || rate < 0 || rate > 10_000 ? { kind: 'rate' } : undefined;
      });
    });
  });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly breadcrumbs = signal([
    { label: this.i18n.t('supplierInvoice.title'), path: '/backoffice/purchases' },
  ]);
  constructor() {
    afterNextRender(() => void this.load());
  }
  protected title(): string {
    return this.i18n.t(this.editing ? 'supplierInvoice.editTitle' : 'supplierInvoice.createTitle');
  }
  protected addLine(): void {
    if (this.model().lines.length >= 500) return;
    this.model.update((model) => ({ ...model, lines: [...model.lines, emptyLine()] }));
    this.invoiceForm().markAsDirty();
  }
  protected removeLine(index: number): void {
    if (this.model().lines.length === 1) return;
    this.model.update((model) => ({
      ...model,
      lines: model.lines.filter((_, position) => position !== index),
    }));
    this.invoiceForm().markAsDirty();
  }
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.invoiceForm().invalid()) {
      this.invoiceForm().markAsTouched();
      return;
    }
    const lines = this.decodeLines();
    if (!lines) {
      this.invoiceForm().markAsTouched();
      return;
    }
    void submit(this.invoiceForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      try {
        const model = this.model();
        const input = {
          supplierId: model.supplierId,
          reference: model.reference,
          invoiceDate: model.invoiceDate,
          dueDate: model.dueDate,
          currency: model.currency,
          notes: model.notes,
          lines,
        };
        const current = this.invoice();
        const outcome = current
          ? await this.api.update(current.id, { ...input, expectedVersion: current.version })
          : await this.api.create({
              ...input,
              requestId: this.requestId,
              source: 'manual',
              sourceFileName: null,
              externalSubmissionId: null,
            });
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.completed.set(true);
        this.invoiceForm().reset(this.model());
        await this.router.navigate(['/backoffice/purchases', outcome.result.id]);
      } catch {
        this.error.set('supplierInvoice.error');
      } finally {
        this.saving.set(false);
      }
    });
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    return (
      this.completed() ||
      !this.invoiceForm().dirty() ||
      this.confirmation.request(this.i18n.t('supplierInvoice.unsavedChanges'))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.invoiceForm().dirty()) event.preventDefault();
  }
  private decodeLines(): ReadonlyArray<SupplierInvoiceLineInputValue> | undefined {
    const lines = this.model().lines.map((line) => ({
      description: line.description,
      netTotalCents: parseFixedDecimal(line.netAmount, 2),
      vatRateBasisPoints: parseFixedDecimal(line.vatRate, 2),
    }));
    if (
      lines.some(
        (line) => line.netTotalCents === undefined || line.vatRateBasisPoints === undefined,
      )
    )
      return undefined;
    const schema = Schema.Array(SupplierInvoiceLineInput);
    return Schema.is(schema)(lines) ? lines : undefined;
  }
  private async load(): Promise<void> {
    try {
      this.suppliers.set((await this.suppliersApi.list()).filter(({ archived }) => !archived));
      if (!this.invoiceId) return;
      const outcome = await this.api.get(this.invoiceId);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      if (outcome.result.status !== 'draft') {
        this.error.set('supplier_invoice.not_editable');
        return;
      }
      this.invoice.set(outcome.result);
      this.invoiceForm().reset({
        supplierId: outcome.result.supplierId,
        reference: outcome.result.reference,
        invoiceDate: outcome.result.invoiceDate,
        dueDate: outcome.result.dueDate,
        currency: outcome.result.currency,
        notes: outcome.result.notes,
        lines: outcome.result.lines.map((line) => ({
          description: line.description,
          netAmount: formatFixedDecimal(line.netTotalCents, 2),
          vatRate: formatFixedDecimal(line.vatRateBasisPoints, 2),
        })),
      });
    } catch {
      this.error.set('supplierInvoice.error');
    } finally {
      this.loading.set(false);
    }
  }
}
