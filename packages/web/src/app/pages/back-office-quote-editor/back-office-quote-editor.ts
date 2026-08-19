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
  FormField,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Ulid,
  type ClientListValue,
  type QuoteCreateRequestValue,
  type QuoteDetailValue,
  type QuoteLineInputValue,
  type QuoteRevisionCreateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { BackOfficeClientsApi } from '../../back-office/back-office-clients-api';
import { BackOfficeQuotesApi, type QuoteErrorCode } from '../../back-office/back-office-quotes-api';
import { formatFixedDecimal, parseFixedDecimal } from '../../back-office/quote-input';
import { I18nService, type TranslationKey } from '../../i18n.service';
import { Button } from '../../shared/button/button';

interface QuoteLineModel {
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly vatRate: string;
}

interface QuoteModel {
  readonly clientId: string;
  readonly conditions: string;
  readonly lines: Array<QuoteLineModel>;
  readonly title: string;
}

const emptyLine = (): QuoteLineModel => ({
  description: '',
  quantity: '1.000',
  unitPrice: '0.00',
  vatRate: '20.00',
});

@Component({
  selector: 'app-back-office-quote-editor',
  imports: [Button, FormField, RouterLink],
  templateUrl: './back-office-quote-editor.html',
  styleUrl: './back-office-quote-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackOfficeQuoteEditor {
  protected readonly i18n = inject(I18nService);
  private readonly clientsApi = inject(BackOfficeClientsApi);
  private readonly quotesApi = inject(BackOfficeQuotesApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly quoteIdParameter = this.route.snapshot.paramMap.get('quoteId');
  private readonly quoteId = this.decodeQuoteId(this.quoteIdParameter);
  protected readonly isNew = computed(() => this.quoteIdParameter === null);
  protected readonly clients = signal<ClientListValue>([]);
  protected readonly detail = signal<QuoteDetailValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal<QuoteModel>({
    clientId: '',
    conditions: '',
    lines: [emptyLine()],
    title: '',
  });
  protected readonly quoteForm = form(this.model, (path) => {
    required(path.clientId);
    required(path.title);
    maxLength(path.title, 120);
    pattern(path.title, /\S/);
    maxLength(path.conditions, 2_000);
    minLength(path.lines, 1);
    maxLength(path.lines, 20);
    applyEach(path.lines, (line) => {
      required(line.description);
      maxLength(line.description, 160);
      pattern(line.description, /\S/);
      pattern(line.quantity, /^\d+(?:[.,]\d{1,3})?$/);
      pattern(line.unitPrice, /^\d+(?:[.,]\d{1,2})?$/);
      pattern(line.vatRate, /^\d+(?:[.,]\d{1,2})?$/);
    });
  });
  protected readonly saveDisabled = computed(
    () =>
      this.saving() ||
      this.loading() ||
      this.quoteForm().invalid() ||
      (this.quoteId !== undefined && !this.quoteForm().dirty()),
  );
  protected readonly totalsAreStale = computed(
    () => this.detail() !== undefined && this.quoteForm().dirty(),
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected addLine(): void {
    if (this.model().lines.length >= 20) return;
    this.model.update((model) => ({ ...model, lines: [...model.lines, emptyLine()] }));
    this.quoteForm().markAsDirty();
  }

  protected removeLine(index: number): void {
    if (this.model().lines.length === 1) return;
    this.model.update((model) => ({
      ...model,
      lines: model.lines.filter((_line, currentIndex) => currentIndex !== index),
    }));
    this.quoteForm().markAsDirty();
  }

  canDeactivate(): boolean {
    return (
      !this.quoteForm().dirty() ||
      globalThis.confirm(this.i18n.t('backOffice.quote.unsavedChanges'))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.quoteForm().dirty()) event.preventDefault();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.quoteForm, async () => {
      const lines = this.parseLines();
      if (lines === undefined) {
        this.error.set('backOffice.quote.validation');
        return;
      }
      this.saving.set(true);
      this.error.set(undefined);
      const model = this.model();
      const common = { conditions: model.conditions, lines, title: model.title.trim() };
      if (this.quoteId === undefined) {
        const clientId = this.decodeQuoteId(model.clientId);
        if (clientId === undefined) {
          this.error.set('backOffice.quote.validation');
          this.saving.set(false);
          return;
        }
        const request: QuoteCreateRequestValue = { ...common, clientId };
        const outcome = await this.quotesApi.create(request);
        this.saving.set(false);
        if (!outcome.success) return this.setError(outcome.code);
        this.detail.set(outcome.result);
        this.quoteForm().reset();
        await this.router.navigate(['/backoffice/quotes', outcome.result.id], { replaceUrl: true });
        return;
      }
      const current = this.detail();
      if (current === undefined) {
        this.error.set('quote.error');
        this.saving.set(false);
        return;
      }
      const request: QuoteRevisionCreateRequestValue = {
        ...common,
        expectedVersion: current.version,
      };
      const outcome = await this.quotesApi.createRevision(this.quoteId, request);
      this.saving.set(false);
      if (!outcome.success) return this.setError(outcome.code);
      this.detail.set(outcome.result);
      this.model.set(this.modelFromDetail(outcome.result));
      this.quoteForm().reset();
    });
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

  private async load(): Promise<void> {
    if (this.quoteIdParameter !== null && this.quoteId === undefined) {
      this.error.set('quote.not_found');
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    try {
      if (this.quoteId === undefined) {
        this.clients.set((await this.clientsApi.list()).filter((client) => !client.archived));
      } else {
        const outcome = await this.quotesApi.get(this.quoteId);
        if (!outcome.success) {
          this.setError(outcome.code);
          this.unavailable.set(true);
          return;
        }
        this.detail.set(outcome.result);
        this.model.set(this.modelFromDetail(outcome.result));
        this.quoteForm().reset();
      }
    } catch {
      this.error.set('quote.error');
      this.unavailable.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private parseLines(): ReadonlyArray<QuoteLineInputValue> | undefined {
    const lines: Array<QuoteLineInputValue> = [];
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
      ) {
        return undefined;
      }
      lines.push({
        description: line.description.trim(),
        quantityMilli,
        unitPriceCents,
        vatRateBasisPoints,
      });
    }
    return lines;
  }

  private modelFromDetail(detail: QuoteDetailValue): QuoteModel {
    return {
      clientId: detail.clientId,
      conditions: detail.currentRevision.conditions,
      title: detail.currentRevision.title,
      lines: detail.currentRevision.lines.map((line) => ({
        description: line.description,
        quantity: formatFixedDecimal(line.quantityMilli, 3),
        unitPrice: formatFixedDecimal(line.unitPriceCents, 2),
        vatRate: formatFixedDecimal(line.vatRateBasisPoints, 2),
      })),
    };
  }

  private decodeQuoteId(value: string | null): UlidValue | undefined {
    if (value === null) return undefined;
    return Option.getOrUndefined(Schema.decodeUnknownOption(Ulid)(value));
  }

  private setError(code: QuoteErrorCode): void {
    this.error.set(code);
  }
}
