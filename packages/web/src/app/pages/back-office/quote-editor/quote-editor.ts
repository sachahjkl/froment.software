import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  applyEach,
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
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';
import {
  Ulid,
  type ClientListValue,
  type QuoteCreateRequestValue,
  type QuoteCancellationReasonValue,
  type QuoteDetailValue,
  type QuoteLineInputValue,
  type QuoteConditionPresetListValue,
  type QuoteRevisionCreateRequestValue,
  type QuoteSendResultValue,
  type QuoteStatusValue,
  type UlidValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi, type QuoteErrorCode } from '@backoffice/quotes-api';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { Icon } from '@shared/icon/icon';
import { TextCopy } from '@shared/text-copy';

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

const statusKeys = {
  draft: 'backOffice.quote.status.draft',
  sent: 'backOffice.quote.status.sent',
  accepted: 'backOffice.quote.status.accepted',
  rejected: 'backOffice.quote.status.rejected',
  expired: 'backOffice.quote.status.expired',
  cancelled: 'backOffice.quote.status.cancelled',
} as const satisfies Record<QuoteStatusValue, TranslationKey>;

@Component({
  selector: 'app-quote-editor',
  imports: [Button, FormField, Icon, Notice, RouterLink],
  templateUrl: './quote-editor.html',
  styleUrl: './quote-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteEditor {
  protected readonly i18n = inject(I18nService);
  private readonly clientsApi = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly conditionPresetsApi = inject(QuoteConditionPresetsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly textCopy = inject(TextCopy);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly quoteId = signal<UlidValue | undefined>(undefined);
  private routeRequest = 0;
  protected readonly isNew = signal(false);
  protected readonly clients = signal<ClientListValue>([]);
  protected readonly conditionPresets = signal<QuoteConditionPresetListValue>([]);
  protected readonly detail = signal<QuoteDetailValue | undefined>(undefined);
  protected readonly previewVersion = signal<number | undefined>(undefined);
  protected readonly pdfPendingVersion = signal<number | undefined>(undefined);
  protected readonly generatedPdfVersions = signal<ReadonlySet<number>>(new Set());
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly sending = signal(false);
  protected readonly cancelling = signal(false);
  protected readonly cancellationReason = signal<QuoteCancellationReasonValue | ''>('');
  protected readonly cancellationNote = signal('');
  protected readonly sentLink = signal<QuoteSendResultValue['link'] | undefined>(undefined);
  protected readonly linkCopied = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal<QuoteModel>({
    clientId: '',
    conditions: '',
    lines: [emptyLine()],
    title: '',
  });
  protected readonly quoteForm = form(this.model, (path) => {
    disabled(path, { when: () => !this.editable() });
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
      validate(line.quantity, ({ value }) => {
        const parsed = parseFixedDecimal(value(), 3);
        return parsed === undefined || parsed === 0
          ? { kind: 'quantity', message: 'Invalid quantity' }
          : undefined;
      });
      validate(line.unitPrice, ({ value }) =>
        parseFixedDecimal(value(), 2) === undefined
          ? { kind: 'unitPrice', message: 'Invalid unit price' }
          : undefined,
      );
      validate(line.vatRate, ({ value }) => {
        const parsed = parseFixedDecimal(value(), 2);
        return parsed === undefined || parsed > 10_000
          ? { kind: 'vatRate', message: 'Invalid VAT rate' }
          : undefined;
      });
    });
  });
  protected readonly editable = computed(
    () => this.isNew() || ['draft', 'expired'].includes(this.detail()?.status ?? ''),
  );
  protected readonly saveDisabled = computed(
    () =>
      this.saving() ||
      this.loading() ||
      !this.editable() ||
      this.quoteForm().invalid() ||
      (this.quoteId() !== undefined && !this.quoteForm().dirty()),
  );
  protected readonly sendDisabled = computed(() => {
    const quote = this.detail();
    return (
      quote === undefined ||
      quote.status !== 'draft' ||
      this.quoteForm().dirty() ||
      this.saving() ||
      this.sending() ||
      this.cancelling()
    );
  });
  protected readonly totalsAreStale = computed(
    () => this.detail() !== undefined && this.quoteForm().dirty(),
  );
  protected readonly previewUrl = computed(() => {
    const version = this.previewVersion();
    const quoteId = this.quoteId();
    if (quoteId === undefined || version === undefined) return undefined;
    return `/api/quotes/${quoteId}/revisions/${version}/preview`;
  });
  protected readonly previewFrameUrl = computed<SafeResourceUrl | undefined>(() => {
    const url = this.previewUrl();
    return url === undefined ? undefined : this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    afterNextRender(() => {
      this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        void this.load(params.get('quoteId'));
      });
    });
  }

  protected addLine(): void {
    if (!this.editable() || this.model().lines.length >= 20) return;
    this.model.update((model) => ({ ...model, lines: [...model.lines, emptyLine()] }));
    this.quoteForm().markAsDirty();
  }

  protected removeLine(index: number): void {
    if (!this.editable() || this.model().lines.length === 1) return;
    this.model.update((model) => ({
      ...model,
      lines: model.lines.filter((_line, currentIndex) => currentIndex !== index),
    }));
    this.quoteForm().markAsDirty();
  }

  protected selectConditionPreset(select: HTMLSelectElement): void {
    const presetId = select.value;
    const preset = this.conditionPresets().find((candidate) => candidate.id === presetId);
    if (preset === undefined || !this.editable()) return;
    this.model.update((model) => ({ ...model, conditions: preset.conditions }));
    this.quoteForm().markAsDirty();
    select.value = '';
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
      const quoteId = this.quoteId();
      if (quoteId === undefined) {
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
        this.previewVersion.set(outcome.result.version);
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
      const outcome = await this.quotesApi.createRevision(quoteId, request);
      this.saving.set(false);
      if (!outcome.success) return this.setError(outcome.code);
      this.detail.set(outcome.result);
      this.previewVersion.set(outcome.result.version);
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

  protected showPreview(version: number): void {
    this.previewVersion.set(version);
  }

  protected async generatePdf(version: number): Promise<void> {
    const quoteId = this.quoteId();
    if (quoteId === undefined) return;
    this.pdfPendingVersion.set(version);
    this.error.set(undefined);
    const outcome = await this.quotesApi.renderPdf(quoteId, version);
    this.pdfPendingVersion.set(undefined);
    if (!outcome.success) return this.setError(outcome.code);
    this.generatedPdfVersions.update((versions) => new Set([...versions, version]));
  }

  protected async sendQuote(): Promise<void> {
    const quoteId = this.quoteId();
    if (quoteId === undefined || this.sendDisabled()) return;
    const quote = this.detail();
    if (quote === undefined) return;
    this.sending.set(true);
    this.error.set(undefined);
    this.linkCopied.set(false);
    const outcome = await this.quotesApi.send(quoteId, { expectedVersion: quote.version });
    this.sending.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.detail.set({ ...quote, status: outcome.result.status });
    this.sentLink.set(outcome.result.link);
  }

  protected async cancelQuote(): Promise<void> {
    const quoteId = this.quoteId();
    const quote = this.detail();
    if (
      quoteId === undefined ||
      quote === undefined ||
      !['draft', 'sent', 'expired'].includes(quote.status) ||
      this.cancelling() ||
      this.cancellationReason() === '' ||
      !globalThis.confirm(this.i18n.t('backOffice.quote.cancelConfirm'))
    ) {
      return;
    }
    this.cancelling.set(true);
    this.error.set(undefined);
    const reason = this.cancellationReason();
    if (reason === '') return;
    const outcome = await this.quotesApi.cancel(quoteId, {
      expectedVersion: quote.version,
      reason,
      note: this.cancellationNote().trim(),
    });
    this.cancelling.set(false);
    if (!outcome.success) return this.setError(outcome.code);
    this.detail.set(outcome.result);
    this.sentLink.set(undefined);
    this.quoteForm().reset();
  }

  protected setCancellationReason(select: HTMLSelectElement): void {
    const reason = Schema.decodeUnknownOption(
      Schema.Literals([
        'client-declined',
        'scope-changed',
        'budget-unavailable',
        'duplicate',
        'replaced',
        'other',
      ]),
    )(select.value);
    this.cancellationReason.set(Option.getOrElse(reason, () => ''));
  }

  protected setCancellationNote(textarea: HTMLTextAreaElement): void {
    this.cancellationNote.set(textarea.value.slice(0, 500));
  }

  protected async copySentLink(): Promise<void> {
    const link = this.sentLink();
    if (link === undefined) return;
    this.linkCopied.set(await this.textCopy.copy(link.url));
  }

  protected statusKey(status: QuoteStatusValue): TranslationKey {
    return statusKeys[status];
  }

  protected pdfUrl(version: number): string | undefined {
    const quoteId = this.quoteId();
    if (quoteId === undefined || !this.generatedPdfVersions().has(version)) return undefined;
    return `/api/quotes/${quoteId}/revisions/${version}/pdf`;
  }

  private async load(parameter: string | null): Promise<void> {
    const request = ++this.routeRequest;
    const quoteId = this.decodeQuoteId(parameter);
    this.quoteId.set(quoteId);
    this.isNew.set(parameter === null);
    this.detail.set(undefined);
    this.previewVersion.set(undefined);
    this.pdfPendingVersion.set(undefined);
    this.generatedPdfVersions.set(new Set());
    this.sentLink.set(undefined);
    this.linkCopied.set(false);
    this.error.set(undefined);
    this.unavailable.set(false);
    this.loading.set(true);
    this.model.set({ clientId: '', conditions: '', lines: [emptyLine()], title: '' });
    this.quoteForm().reset();
    if (parameter !== null && quoteId === undefined) {
      this.error.set('quote.not_found');
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    try {
      if (quoteId === undefined) {
        const [conditionPresets, clients] = await Promise.all([
          this.conditionPresetsApi.list(),
          this.clientsApi.list(),
        ]);
        if (request !== this.routeRequest) return;
        this.conditionPresets.set(conditionPresets);
        this.clients.set(clients.filter((client) => !client.archived));
      } else {
        const [conditionPresets, outcome] = await Promise.all([
          this.conditionPresetsApi.list(),
          this.quotesApi.get(quoteId),
        ]);
        if (request !== this.routeRequest) return;
        this.conditionPresets.set(conditionPresets);
        if (!outcome.success) {
          this.setError(outcome.code);
          this.unavailable.set(true);
          return;
        }
        this.detail.set(outcome.result);
        this.previewVersion.set(outcome.result.version);
        this.model.set(this.modelFromDetail(outcome.result));
        this.quoteForm().reset();
      }
    } catch {
      if (request !== this.routeRequest) return;
      this.error.set('quote.error');
      this.unavailable.set(true);
    } finally {
      if (request === this.routeRequest) this.loading.set(false);
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
    const decimalSeparator = this.i18n.language() === 'fr' ? ',' : '.';
    return {
      clientId: detail.clientId,
      conditions: detail.currentRevision.conditions,
      title: detail.currentRevision.title,
      lines: detail.currentRevision.lines.map((line) => ({
        description: line.description,
        quantity: formatFixedDecimal(line.quantityMilli, 3, decimalSeparator),
        unitPrice: formatFixedDecimal(line.unitPriceCents, 2, decimalSeparator),
        vatRate: formatFixedDecimal(line.vatRateBasisPoints, 2, decimalSeparator),
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
