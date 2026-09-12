import { Can } from '@backoffice/can';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { form, FormField, maxLength, pattern, required } from '@angular/forms/signals';
import { Router } from '@angular/router';
import {
  CreditNoteDraftRequest,
  CreditNoteDraftUpdate,
  type CreditNote,
  type InvoiceCredits,
  type InvoiceDetailValue,
  type UlidValue,
  Ulid,
} from '@froment/contracts';
import { Schema } from 'effect';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { InvoiceTask } from '../billing/invoice-task';
import { TaskFeedback } from '../billing/task-feedback';
import { InvoiceTaskHeader } from '../billing/invoice-task-header';

interface CreditLineModel {
  readonly invoiceId: UlidValue;
  readonly invoiceVersion: number;
  readonly invoiceNumber: string;
  readonly sourceLineId: UlidValue;
  readonly description: string;
  readonly availableQuantityMilli: number;
  readonly quantityMilli: number;
}

@Component({
  selector: 'app-credit-editor',
  imports: [Can, Button, DataTable, Notice, FormField, TaskFeedback, InvoiceTaskHeader],
  providers: [InvoiceTask],
  templateUrl: './credit-editor.html',
  styleUrl: './credit-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'page-container',
    '(window:beforeunload)': 'task.beforeUnload($event, hasUnsavedChanges())',
  },
})
export class CreditEditor {
  protected readonly task = inject(InvoiceTask);
  protected readonly i18n = this.task.i18n;
  private readonly api = inject(InvoiceCreditsApi);
  private readonly router = inject(Router);
  private readonly creditNoteId = this.task.route.snapshot.paramMap.get('creditNoteId');
  private readonly fullMode = this.task.route.snapshot.queryParamMap.get('mode') === 'full';
  private readonly reasonModel = signal({ reason: '' });
  protected readonly creditForm = form(this.reasonModel, (path) => {
    required(path.reason);
    pattern(path.reason, /\S/);
    maxLength(path.reason, 1_000);
  });
  protected readonly lines = signal<ReadonlyArray<CreditLineModel>>([]);
  private readonly saved = signal<typeof CreditNote.Type | undefined>(undefined);
  protected readonly selectedVersion = signal<number | undefined>(undefined);
  protected readonly revisions = computed(() => this.saved()?.revisions ?? []);
  protected readonly selectedRevision = computed(() =>
    this.revisions().find((revision) => revision.version === this.selectedVersion()),
  );
  protected readonly readonlyVersion = computed(() => {
    const saved = this.saved();
    return (
      saved !== undefined && (saved.status === 'issued' || this.selectedVersion() !== saved.version)
    );
  });
  protected readonly displayLines = computed<ReadonlyArray<CreditLineModel>>(() => {
    const saved = this.saved();
    const version = this.selectedVersion();
    if (!saved || version === saved.version) return this.lines();
    return (
      saved.revisions
        .find((revision) => revision.version === version)
        ?.lines.map((line) => ({
          invoiceId: line.invoiceId,
          invoiceVersion: line.invoiceVersion,
          invoiceNumber: line.invoiceNumber,
          sourceLineId: line.sourceLineId,
          description: line.description,
          availableQuantityMilli: line.quantityMilli,
          quantityMilli: line.quantityMilli,
        })) ?? []
    );
  });
  private baseline = '';
  private createRequestId: string | undefined;
  private issueRequestId: string | undefined;
  private initialized = false;
  protected readonly sourceInvoice = this.task.invoice;
  protected readonly credits = resource({
    params: () => this.task.invoice()?.id,
    loader: ({ params }) => this.api.get(params),
  });
  private readonly existingNote = resource({
    params: () => this.creditNoteId ?? undefined,
    loader: ({ params }) => this.api.getNote(params),
  });
  protected readonly invoices = resource({ loader: () => this.task.api.list() });
  protected readonly selectedInvoiceId = signal('');
  protected readonly addableInvoices = computed(() => {
    const source = this.sourceInvoice();
    const loaded = new Set(this.lines().map((line) => line.invoiceId));
    if (!source || !this.invoices.hasValue()) return [];
    return this.invoices
      .value()
      .filter(
        (invoice) =>
          invoice.clientId === source.clientId &&
          invoice.currency === source.currentRevision.currency &&
          (invoice.status === 'issued' || invoice.status === 'paid') &&
          invoice.creditedCents < invoice.totalCents &&
          !loaded.has(invoice.id),
      );
  });
  protected readonly totalQuantity = computed(() =>
    this.lines().reduce((total, line) => total + line.quantityMilli, 0),
  );
  protected readonly eligible = computed(
    () =>
      !this.task.locked() &&
      !this.readonlyVersion() &&
      this.totalQuantity() > 0 &&
      this.creditForm.reason().valid() &&
      this.lines().every(
        (line) => line.quantityMilli >= 0 && line.quantityMilli <= line.availableQuantityMilli,
      ),
  );
  protected readonly hasUnsavedChanges = computed(
    () => this.snapshot() !== this.baseline || this.creditForm().dirty(),
  );

  constructor() {
    effect(() => {
      if (this.initialized) return;
      const invoice = this.task.invoice();
      if (!invoice) return;
      if (this.creditNoteId !== null) {
        if (!this.existingNote.hasValue()) return;
        const outcome = this.existingNote.value();
        if (!outcome.success) {
          this.task.error.set(outcome.code);
          return;
        }
        const note = outcome.result;
        this.saved.set(note);
        this.selectedVersion.set(note.version);
        this.reasonModel.set({ reason: note.reason });
        this.lines.set(
          note.lines.map((line) => ({
            invoiceId: line.invoiceId,
            invoiceVersion: line.invoiceVersion,
            invoiceNumber: line.invoiceNumber,
            sourceLineId: line.sourceLineId,
            description: line.description,
            availableQuantityMilli: line.quantityMilli,
            quantityMilli: line.quantityMilli,
          })),
        );
      } else {
        if (!this.credits.hasValue()) return;
        const outcome = this.credits.value();
        if (!outcome.success) {
          this.task.error.set(outcome.code);
          return;
        }
        this.lines.set(this.linesForInvoice(invoice, outcome.result, this.fullMode));
      }
      this.initialized = true;
      this.baseline = this.snapshot();
      this.creditForm().reset(this.reasonModel());
    });
  }

  private linesForInvoice(
    invoice: InvoiceDetailValue,
    credits: typeof InvoiceCredits.Type,
    selectAll: boolean,
  ): ReadonlyArray<CreditLineModel> {
    return invoice.currentRevision.lines.flatMap((line) => {
      const credited = credits.creditNotes
        .filter((note) => note.status === 'issued')
        .flatMap((note) => note.lines)
        .filter((creditLine) => creditLine.sourceLineId === line.id)
        .reduce((total, creditLine) => total + creditLine.quantityMilli, 0);
      const availableQuantityMilli = line.quantityMilli - credited;
      if (availableQuantityMilli <= 0 || invoice.invoiceNumber === null) return [];
      return [
        {
          invoiceId: invoice.id,
          invoiceVersion: invoice.version,
          invoiceNumber: invoice.invoiceNumber,
          sourceLineId: line.id,
          description: line.description,
          availableQuantityMilli,
          quantityMilli: selectAll ? availableQuantityMilli : 0,
        },
      ];
    });
  }

  protected quantity(line: CreditLineModel): string {
    return formatFixedDecimal(line.quantityMilli, 3, this.i18n.language() === 'fr' ? ',' : '.');
  }

  protected availableQuantity(line: CreditLineModel): string {
    return formatFixedDecimal(
      line.availableQuantityMilli,
      3,
      this.i18n.language() === 'fr' ? ',' : '.',
    );
  }

  protected updateQuantity(sourceLineId: string, value: string): void {
    const quantityMilli = parseFixedDecimal(value, 3) ?? -1;
    this.lines.update((lines) =>
      lines.map((line) => (line.sourceLineId === sourceLineId ? { ...line, quantityMilli } : line)),
    );
  }

  protected removeInvoice(invoiceId: string): void {
    if (invoiceId === this.sourceInvoice()?.id) return;
    this.lines.update((lines) => lines.filter((line) => line.invoiceId !== invoiceId));
  }

  protected async addInvoice(): Promise<void> {
    const invoiceId = this.selectedInvoiceId();
    if (!invoiceId || this.task.busy()) return;
    this.task.busy.set(true);
    this.task.error.set(undefined);
    try {
      const [invoiceOutcome, creditsOutcome] = await Promise.all([
        this.task.api.get(Schema.decodeUnknownSync(Ulid)(invoiceId)),
        this.api.get(invoiceId),
      ]);
      if (!invoiceOutcome.success) {
        this.task.error.set(invoiceOutcome.code);
        return;
      }
      if (!creditsOutcome.success) {
        this.task.error.set(creditsOutcome.code);
        return;
      }
      this.lines.update((lines) => [
        ...lines,
        ...this.linesForInvoice(invoiceOutcome.result, creditsOutcome.result, true),
      ]);
      this.selectedInvoiceId.set('');
    } catch {
      this.task.error.set('invoice.error');
    } finally {
      this.task.busy.set(false);
    }
  }

  private requestLines() {
    return this.lines()
      .filter((line) => line.quantityMilli > 0)
      .map((line) => ({
        invoiceId: line.invoiceId,
        invoiceVersion: line.invoiceVersion,
        sourceLineId: line.sourceLineId,
        quantityMilli: line.quantityMilli,
      }));
  }

  private snapshot(): string {
    return JSON.stringify({ reason: this.reasonModel().reason.trim(), lines: this.requestLines() });
  }

  private async saveDraft(): Promise<typeof CreditNote.Type | undefined> {
    if (!this.eligible()) return undefined;
    const current = this.saved();
    this.task.busy.set(true);
    this.task.error.set(undefined);
    try {
      const outcome = current
        ? await this.api.update(
            current.id,
            CreditNoteDraftUpdate.make({
              expectedVersion: current.version,
              reason: this.reasonModel().reason.trim(),
              lines: this.requestLines(),
            }),
          )
        : await this.api.create(
            CreditNoteDraftRequest.make({
              requestId: (this.createRequestId ??= crypto.randomUUID()),
              reason: this.reasonModel().reason.trim(),
              lines: this.requestLines(),
            }),
          );
      if (!outcome.success) {
        this.createRequestId = undefined;
        this.task.error.set(outcome.code);
        if (outcome.code === 'invoice.credit_conflict') this.task.stale.set(true);
        return undefined;
      }
      this.saved.set(outcome.result);
      this.createRequestId = undefined;
      this.selectedVersion.set(outcome.result.version);
      this.baseline = this.snapshot();
      this.creditForm().reset(this.reasonModel());
      return outcome.result;
    } catch {
      this.task.error.set('invoice.error');
      return undefined;
    } finally {
      this.task.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    const note = await this.saveDraft();
    const invoice = this.sourceInvoice();
    if (!note || !invoice) return;
    await this.router.navigate(['/backoffice/invoices', invoice.id, 'credits', note.id, 'edit'], {
      queryParams: this.task.navigation.detailQuery(),
      replaceUrl: true,
    });
  }

  protected async issue(): Promise<void> {
    if (
      !this.eligible() ||
      !(await this.task.confirmation.request(this.i18n.t('credit.confirmIssue')))
    )
      return;
    const note = await this.saveDraft();
    if (!note) return;
    this.task.busy.set(true);
    try {
      const outcome = await this.api.issue(note.id, {
        requestId: (this.issueRequestId ??= crypto.randomUUID()),
        expectedVersion: note.version,
      });
      if (!outcome.success) {
        this.issueRequestId = undefined;
        this.task.error.set(outcome.code);
        return;
      }
      this.task.completed.set(true);
      this.issueRequestId = undefined;
      await this.router.navigate(['/backoffice/billing/credit-notes']);
    } catch {
      this.task.error.set('invoice.error');
    } finally {
      this.task.busy.set(false);
    }
  }

  canDeactivate(): Promise<boolean> {
    return this.task.canDeactivate(this.hasUnsavedChanges());
  }
}
