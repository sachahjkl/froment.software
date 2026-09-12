import { formatMoney } from '@froment/l10n';
import { Can } from '@backoffice/can';
import type { PermissionCodeValue } from '@froment/contracts';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  PendingTasks,
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
import {
  Ulid,
  type ClientListValue,
  type QuoteCreateRequestValue,
  type QuoteDetailValue,
  type QuoteLineInputValue,
  type QuoteConditionPresetListValue,
  type QuoteConditionPresetValue,
  type CatalogItemValue,
  type QuoteRevisionCreateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';

import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi, type QuoteErrorCode } from '@backoffice/quotes-api';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { CatalogApi } from '@backoffice/catalog-api';
import { type CatalogItemListValue } from '@froment/contracts';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { OutcomePanel } from '@shared/outcome-panel/outcome-panel';
import { ObjectPicker } from '@shared/object-picker/object-picker';
import { affairContext } from '../affairs/affair-filters';
import { CatalogEditor } from '../catalog-editor/catalog-editor';
import { ConditionEditor } from '../quote-condition-presets/condition-editor';
import {
  documentTextContent,
  isDocumentText,
  type DocumentTextPresentationValue,
} from '@froment/contracts';
import { DocumentTextEditor } from '@shared/document-text-editor/document-text-editor';
import {
  DocumentLineEditor,
  type DocumentLineEditValue,
} from '@shared/document-line-editor/document-line-editor';

type QuoteLineModel = DocumentLineEditValue;

interface QuoteModel {
  readonly clientId: string;
  readonly currency: string;
  readonly conditions: string;
  readonly conditionsPresentation?: DocumentTextPresentationValue;
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
  host: { class: 'page-container' },
  selector: 'app-quote-editor',
  imports: [
    Can,
    Button,
    FormField,
    ObjectPicker,
    Notice,
    OutcomePanel,
    PageHeader,
    RouterLink,
    DocumentTextEditor,
    DocumentLineEditor,
  ],
  templateUrl: './quote-editor.html',
  styleUrl: './quote-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteEditor {
  protected readonly writePermission = computed<PermissionCodeValue>(() =>
    this.isNew() ? 'quote.create' : 'quote.update',
  );
  private readonly confirmation = inject(Confirmation);
  private readonly catalogApi = inject(CatalogApi);
  protected readonly catalogItems = signal<CatalogItemListValue>([]);
  protected readonly i18n = inject(I18nService);
  private readonly clientsApi = inject(ClientsApi);
  private readonly quotesApi = inject(QuotesApi);
  private readonly conditionPresetsApi = inject(QuoteConditionPresetsApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly context = signal(affairContext(this.route.snapshot.queryParamMap));
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pendingTasks = inject(PendingTasks);
  private readonly dialogs = inject(Dialog);
  private readonly referenceDialog = signal<
    | DialogRef<CatalogItemValue, CatalogEditor>
    | DialogRef<QuoteConditionPresetValue, ConditionEditor>
    | undefined
  >(undefined);
  private referenceRequest = 0;
  private readonly applyingConditions = signal(false);
  protected readonly referenceBusy = computed(
    () => this.referenceDialog() !== undefined || this.applyingConditions(),
  );
  protected readonly referenceError = signal<TranslationKey | undefined>(undefined);
  protected readonly referenceNotice = signal<TranslationKey | undefined>(undefined);
  private readonly quoteId = signal<UlidValue | undefined>(undefined);
  private routeRequest = 0;
  protected readonly isNew = signal(false);
  protected readonly titleKey = computed<TranslationKey>(() =>
    this.isNew() ? 'backOffice.quote.title.new' : 'backOffice.quote.title.edit',
  );
  protected readonly saveKey = computed<TranslationKey>(() =>
    this.saving() ? 'backOffice.quote.saving' : 'backOffice.quote.save',
  );
  protected readonly clients = signal<ClientListValue>([]);
  protected readonly conditionPresets = signal<QuoteConditionPresetListValue>([]);
  protected readonly detail = signal<QuoteDetailValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly unavailable = signal(false);
  protected readonly saving = signal(false);
  protected readonly completed = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly presetOptions = computed(() =>
    this.conditionPresets().map((preset) => {
      const text = documentTextContent(preset.conditions, preset.conditionsPresentation);
      return {
        id: preset.id,
        label: preset.name,
        detail: text.length > 160 ? `${text.slice(0, 159)}…` : text,
      };
    }),
  );
  private readonly model = signal<QuoteModel>({
    clientId: '',
    currency: 'EUR',
    conditions: '',
    lines: [emptyLine()],
    title: '',
  });
  protected readonly conditionsPresentation = computed(() => this.model().conditionsPresentation);
  protected readonly catalogOptions = computed(() =>
    this.catalogItems()
      .filter((item) => item.currency === this.model().currency)
      .map((item) => ({
        id: item.id,
        label: item.description,
        detail: this.money(item.unitPriceCents),
      })),
  );
  protected readonly quoteForm = form(this.model, (path) => {
    disabled(path, {
      when: () =>
        !this.editable() ||
        this.saving() ||
        this.completed() ||
        this.uncertain() ||
        this.referenceBusy(),
    });
    required(path.clientId);
    required(path.currency);
    maxLength(path.currency, 3);
    pattern(path.currency, /^[A-Z]{3}$/);
    required(path.title);
    maxLength(path.title, 120);
    pattern(path.title, /\S/);
    maxLength(path.conditions, 2_000);
    validate(path.conditions, ({ value }) =>
      !isDocumentText(value(), this.model().conditionsPresentation?.format ?? 'plain')
        ? { kind: 'format' }
        : undefined,
    );
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
          ? { kind: 'quantity', message: 'invalid_quantity' }
          : undefined;
      });
      validate(line.unitPrice, ({ value }) =>
        parseFixedDecimal(value(), 2) === undefined
          ? { kind: 'unitPrice', message: 'invalid_unit_price' }
          : undefined,
      );
      validate(line.vatRate, ({ value }) => {
        const parsed = parseFixedDecimal(value(), 2);
        return parsed === undefined || parsed > 10_000
          ? { kind: 'vatRate', message: 'invalid_vat_rate' }
          : undefined;
      });
    });
  });
  protected readonly editable = computed(
    () => this.isNew() || ['draft', 'expired'].includes(this.detail()?.status ?? ''),
  );
  protected readonly saveDisabled = computed(
    () =>
      this.saving() || this.loading() || !this.editable() || this.completed() || this.uncertain(),
  );
  protected readonly totalsAreStale = computed(
    () =>
      this.detail() !== undefined &&
      (this.quoteForm().dirty() || this.saving() || this.uncertain()),
  );
  protected readonly lineTotals = computed(() =>
    this.totalsAreStale()
      ? []
      : (this.detail()?.currentRevision.lines.map((line) => line.totalCents) ?? []),
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.referenceDialog()?.close());
    afterNextRender(() => {
      this.route.queryParamMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => this.context.set(affairContext(params)));
      this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        void this.load(params.get('quoteId'));
      });
    });
  }

  protected setLines(lines: ReadonlyArray<DocumentLineEditValue>): void {
    if (this.saveDisabled() || this.referenceBusy()) return;
    this.model.update((model) => ({ ...model, lines: [...lines] }));
    this.quoteForm().markAsDirty();
  }

  protected addCatalogItem(id: string): void {
    const item = this.catalogItems().find((entry) => entry.id === id);
    if (
      this.saveDisabled() ||
      this.referenceBusy() ||
      this.model().lines.length >= 20 ||
      item === undefined ||
      item.archived
    )
      return;
    this.model.update((model) => ({
      ...model,
      lines: [
        ...model.lines,
        {
          description: item.description,
          quantity: formatFixedDecimal(item.quantityMilli, 3),
          unitPrice: formatFixedDecimal(item.unitPriceCents, 2),
          vatRate: formatFixedDecimal(item.vatRateBasisPoints, 2),
        },
      ],
    }));
    this.quoteForm().markAsDirty();
  }

  protected async selectConditionPreset(presetId: string): Promise<void> {
    const preset = this.conditionPresets().find((candidate) => candidate.id === presetId);
    if (preset === undefined || this.saveDisabled() || this.referenceBusy()) return;
    const generation = this.routeRequest;
    this.applyingConditions.set(true);
    try {
      if (
        this.model().conditions &&
        (this.model().conditions !== preset.conditions ||
          JSON.stringify(this.model().conditionsPresentation) !==
            JSON.stringify(preset.conditionsPresentation)) &&
        !(await this.confirmation.request(this.i18n.t('commercial.replaceConditions')))
      )
        return;
      if (this.destroyRef.destroyed || generation !== this.routeRequest || this.saveDisabled())
        return;
      this.model.update((model) => ({
        ...model,
        conditions: preset.conditions,
        conditionsPresentation: preset.conditionsPresentation,
      }));
      this.quoteForm().markAsDirty();
    } finally {
      this.applyingConditions.set(false);
    }
  }

  protected setConditionsPresentation(conditionsPresentation: DocumentTextPresentationValue): void {
    if (this.quoteForm.conditions().disabled()) return;
    this.model.update((model) => ({ ...model, conditionsPresentation }));
    this.quoteForm.conditions().markAsDirty();
  }

  protected createCatalogItem(): void {
    if (this.saveDisabled() || this.referenceBusy() || this.model().lines.length >= 20) return;
    const generation = this.routeRequest;
    const request = ++this.referenceRequest;
    this.referenceError.set(undefined);
    this.referenceNotice.set(undefined);
    const dialog = this.dialogs.open<CatalogItemValue, undefined, CatalogEditor>(CatalogEditor, {
      ariaLabelledBy: 'catalog-editor-title',
      ariaModal: true,
      autoFocus: '#catalog-description',
      restoreFocus: '#quote-create-catalog',
      disableClose: true,
      closeOnNavigation: false,
      disableAnimations: true,
      width: '48rem',
      maxWidth: 'calc(100vw - 2rem)',
    });
    this.referenceDialog.set(dialog);
    dialog.closed.subscribe((item) => {
      this.referenceDialog.set(undefined);
      if (this.destroyRef.destroyed || generation !== this.routeRequest) return;
      if (item) {
        this.catalogItems.update((items) => [
          ...items.filter((entry) => entry.id !== item.id),
          item,
        ]);
        this.referenceNotice.set('catalog.saved');
        this.addCatalogItem(item.id);
      } else void this.refreshCatalog(generation, request);
    });
  }

  protected createConditionPreset(): void {
    if (this.saveDisabled() || this.referenceBusy()) return;
    const generation = this.routeRequest;
    const request = ++this.referenceRequest;
    this.referenceError.set(undefined);
    this.referenceNotice.set(undefined);
    const dialog = this.dialogs.open<QuoteConditionPresetValue, undefined, ConditionEditor>(
      ConditionEditor,
      {
        ariaLabelledBy: 'condition-editor-title',
        ariaModal: true,
        autoFocus: '#preset-name',
        restoreFocus: '#quote-create-conditions',
        disableClose: true,
        closeOnNavigation: false,
        disableAnimations: true,
        width: '56rem',
        maxWidth: 'calc(100vw - 2rem)',
      },
    );
    this.referenceDialog.set(dialog);
    dialog.closed.subscribe((preset) => {
      this.referenceDialog.set(undefined);
      if (this.destroyRef.destroyed || generation !== this.routeRequest) return;
      if (preset) {
        this.conditionPresets.update((presets) => [
          ...presets.filter((entry) => entry.id !== preset.id),
          preset,
        ]);
        this.referenceNotice.set('referenceEditor.conditionsSaved');
        void this.selectConditionPreset(preset.id);
      } else void this.refreshConditionPresets(generation, request);
    });
  }

  private async refreshCatalog(generation: number, request: number): Promise<void> {
    try {
      const items = await this.catalogApi.list();
      if (
        this.destroyRef.destroyed ||
        generation !== this.routeRequest ||
        request !== this.referenceRequest
      )
        return;
      this.catalogItems.set(items.filter((item) => !item.archived));
    } catch {
      if (
        !this.destroyRef.destroyed &&
        generation === this.routeRequest &&
        request === this.referenceRequest
      )
        this.referenceError.set('catalogWorkspace.loadError');
    }
  }

  private async refreshConditionPresets(generation: number, request: number): Promise<void> {
    try {
      const presets = await this.conditionPresetsApi.list();
      if (
        this.destroyRef.destroyed ||
        generation !== this.routeRequest ||
        request !== this.referenceRequest
      )
        return;
      this.conditionPresets.set(presets);
    } catch {
      if (
        !this.destroyRef.destroyed &&
        generation === this.routeRequest &&
        request === this.referenceRequest
      )
        this.referenceError.set('quote.error');
    }
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving() || this.referenceBusy()) return false;
    if (this.uncertain())
      return this.confirmation.request(this.i18n.t('commercial.leaveUncertain'));
    return (
      this.completed() ||
      !this.quoteForm().dirty() ||
      (await this.confirmation.request(this.i18n.t('backOffice.quote.unsavedChanges')))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (
      this.saving() ||
      this.referenceBusy() ||
      this.uncertain() ||
      (!this.completed() && this.quoteForm().dirty())
    )
      event.preventDefault();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saveDisabled() || this.referenceBusy()) return;
    const fields = [
      this.quoteForm.clientId,
      this.quoteForm.title,
      ...Array.from(this.quoteForm.lines).flatMap((line) => [
        line.description,
        line.quantity,
        line.unitPrice,
        line.vatRate,
      ]),
      this.quoteForm.conditions,
    ];
    for (const field of fields) field().markAsTouched();
    const invalid = fields.find((field) => field().invalid());
    if (invalid) {
      invalid().focusBoundControl();
      return;
    }
    void submit(this.quoteForm, async () => {
      const lines = this.parseLines();
      if (lines === undefined) {
        this.error.set('backOffice.quote.validation');
        return;
      }
      this.saving.set(true);
      this.error.set(undefined);
      const generation = this.routeRequest;
      try {
        const model = this.model();
        const values = {
          conditions: model.conditions,
          currency: model.currency,
          lines,
          title: model.title.trim(),
        };
        const common =
          model.conditionsPresentation === undefined
            ? values
            : { ...values, conditionsPresentation: model.conditionsPresentation };
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
          if (this.destroyRef.destroyed || generation !== this.routeRequest) return;
          if (!outcome.success) {
            if (outcome.code === 'quote.error') {
              this.uncertain.set(true);
              this.error.set('commercial.saveUncertain');
              return;
            }
            return this.setError(outcome.code);
          }
          this.detail.set(outcome.result);
          this.completed.set(true);
          this.quoteForm().reset();
          this.saving.set(false);
          await this.router.navigate(['/backoffice/quotes', outcome.result.id], {
            replaceUrl: true,
            queryParams: this.context(),
          });
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
        if (this.destroyRef.destroyed || generation !== this.routeRequest) return;
        if (!outcome.success) return this.setError(outcome.code);
        this.detail.set(outcome.result);
        this.model.set(this.modelFromDetail(outcome.result));
        this.quoteForm().reset();
        this.completed.set(true);
        this.saving.set(false);
        await this.router.navigate(['/backoffice/quotes', outcome.result.id], {
          queryParams: this.context(),
        });
      } catch {
        if (this.destroyRef.destroyed || generation !== this.routeRequest) return;
        if (this.quoteId() === undefined) {
          this.uncertain.set(true);
          this.error.set('commercial.saveUncertain');
        } else this.error.set('quote.error');
      } finally {
        if (generation === this.routeRequest) this.saving.set(false);
      }
    });
  }

  protected async reload(): Promise<void> {
    if (this.saving() || this.uncertain() || this.referenceBusy()) return;
    const generation = this.routeRequest;
    if (
      this.quoteForm().dirty() &&
      !(await this.confirmation.request(this.i18n.t('commercial.reloadConfirm')))
    )
      return;
    if (
      this.destroyRef.destroyed ||
      generation !== this.routeRequest ||
      this.saving() ||
      this.referenceBusy()
    )
      return;
    await this.load(this.route.snapshot.paramMap.get('quoteId'));
  }

  protected money(cents: number): string {
    return formatMoney(cents, this.i18n.language(), this.model().currency);
  }

  private async load(parameter: string | null): Promise<void> {
    const request = ++this.routeRequest;
    this.referenceDialog()?.close();
    this.referenceError.set(undefined);
    this.referenceNotice.set(undefined);
    const requestedClientId = this.decodeQuoteId(this.route.snapshot.queryParamMap.get('clientId'));
    const quoteId = this.decodeQuoteId(parameter);
    this.quoteId.set(quoteId);
    this.isNew.set(parameter === null);
    this.detail.set(undefined);
    this.saving.set(false);
    this.completed.set(false);
    this.uncertain.set(false);
    this.error.set(undefined);
    this.unavailable.set(false);
    this.loading.set(true);
    this.model.set({
      clientId: '',
      currency: 'EUR',
      conditions: '',
      lines: [emptyLine()],
      title: '',
    });
    this.quoteForm().reset();
    if (parameter !== null && quoteId === undefined) {
      this.error.set('quote.not_found');
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    const finishLoading = this.pendingTasks.add();
    try {
      if (quoteId === undefined) {
        const [conditionPresets, clients, catalogItems] = await Promise.all([
          this.conditionPresetsApi.list(),
          this.clientsApi.list(),
          this.catalogApi.list(),
        ]);
        if (this.destroyRef.destroyed || request !== this.routeRequest) return;
        this.conditionPresets.set(conditionPresets);
        this.clients.set(clients.filter((client) => !client.archived));
        if (requestedClientId && this.clients().some((client) => client.id === requestedClientId)) {
          this.model.update((model) => ({ ...model, clientId: requestedClientId }));
          this.quoteForm().reset();
        }
        this.catalogItems.set(catalogItems.filter((item) => !item.archived));
      } else {
        const [conditionPresets, outcome, catalogItems] = await Promise.all([
          this.conditionPresetsApi.list(),
          this.quotesApi.get(quoteId),
          this.catalogApi.list(),
        ]);
        if (this.destroyRef.destroyed || request !== this.routeRequest) return;
        this.conditionPresets.set(conditionPresets);
        if (!outcome.success) {
          this.setError(outcome.code);
          this.unavailable.set(true);
          return;
        }
        this.detail.set(outcome.result);
        this.catalogItems.set(catalogItems.filter((item) => !item.archived));
        this.model.set(this.modelFromDetail(outcome.result));
        this.quoteForm().reset();
      }
    } catch {
      if (this.destroyRef.destroyed || request !== this.routeRequest) return;
      this.error.set('quote.error');
      this.unavailable.set(true);
    } finally {
      if (request === this.routeRequest) this.loading.set(false);
      finishLoading();
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
      currency: detail.currentRevision.currency,
      conditions: detail.currentRevision.conditions,
      conditionsPresentation: detail.currentRevision.conditionsPresentation,
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
