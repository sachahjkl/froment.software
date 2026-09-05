import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormField,
  disabled,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import {
  CatalogItemCreateRequest,
  type CatalogItemValue,
  type CatalogItemListValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { CatalogApi } from '@backoffice/catalog-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';

const emptyModel = () => ({
  description: '',
  quantity: '1.000',
  unitPrice: '0.00',
  vatRate: '20.00',
  archived: false,
});

@Component({
  imports: [Button, FormField, Notice],
  selector: 'app-catalog',
  styleUrl: './catalog.scss',
  templateUrl: './catalog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Catalog {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(CatalogApi);
  private readonly model = signal(emptyModel());
  protected readonly saving = signal(false);
  protected readonly loading = signal(true);
  protected readonly items = signal<CatalogItemListValue>([]);
  protected readonly editing = signal<CatalogItemValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saved = signal(false);
  protected readonly filters = form(signal({ search: '', archived: false }));
  protected readonly visibleItems = computed(() => {
    const { search, archived } = this.filters().value();
    return this.items().filter(
      (item) =>
        (archived || !item.archived) &&
        item.description.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    );
  });
  protected readonly itemForm = form(this.model, (path) => {
    disabled(path, () => this.saving());
    required(path.description);
    maxLength(path.description, 160);
    pattern(path.description, /\S/);
    required(path.quantity);
    pattern(path.quantity, /^\d+(?:[.,]\d{1,3})?$/);
    required(path.unitPrice);
    pattern(path.unitPrice, /^\d+(?:[.,]\d{1,2})?$/);
    required(path.vatRate);
    pattern(path.vatRate, /^\d+(?:[.,]\d{1,2})?$/);
  });
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  canDeactivate(): boolean {
    return (
      !this.saving() &&
      (!this.itemForm().dirty() ||
        globalThis.confirm(this.i18n.t('backOffice.quote.unsavedChanges')))
    );
  }
  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.itemForm().dirty() || this.saving()) event.preventDefault();
  }
  protected invalid(field: 'description' | 'quantity' | 'unitPrice' | 'vatRate'): boolean {
    return this.itemForm[field]().invalid() && this.itemForm[field]().touched();
  }
  protected edit(item: CatalogItemValue): void {
    if (!this.canDeactivate()) return;
    this.editing.set(item);
    this.model.set({
      description: item.description,
      quantity: formatFixedDecimal(item.quantityMilli, 3),
      unitPrice: formatFixedDecimal(item.unitPriceCents, 2),
      vatRate: formatFixedDecimal(item.vatRateBasisPoints, 2),
      archived: item.archived,
    });
    this.itemForm().reset();
    this.error.set(undefined);
    this.saved.set(false);
  }
  protected cancel(): void {
    if (this.canDeactivate()) this.reset();
  }
  protected async load(): Promise<void> {
    if (this.saving()) return;
    this.loading.set(true);
    this.error.set(undefined);
    try {
      this.items.set(await this.api.list());
    } catch {
      this.error.set('catalog.error');
    } finally {
      this.loading.set(false);
    }
  }
  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving()) return;
    void submit(this.itemForm, async () => {
      const model = this.model();
      const request = Schema.decodeUnknownOption(CatalogItemCreateRequest)({
        description: model.description.trim(),
        quantityMilli: parseFixedDecimal(model.quantity, 3),
        unitPriceCents: parseFixedDecimal(model.unitPrice, 2),
        vatRateBasisPoints: parseFixedDecimal(model.vatRate, 2),
        currency: 'EUR',
      });
      if (Option.isNone(request)) {
        this.error.set('catalog.invalid');
        return;
      }
      this.saving.set(true);
      this.error.set(undefined);
      this.saved.set(false);
      const item = this.editing();
      const outcome =
        item === undefined
          ? await this.api.create(request.value)
          : await this.api.update(item.id, {
              ...request.value,
              expectedVersion: item.version,
              archived: model.archived,
            });
      this.saving.set(false);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.items.update((items) => [
        ...items.filter((value) => value.id !== outcome.result.id),
        outcome.result,
      ]);
      this.reset();
      this.saved.set(true);
    });
  }
  protected decimal(value: number, places: number): string {
    return formatFixedDecimal(value, places, this.i18n.language() === 'fr' ? ',' : '.');
  }
  private reset(): void {
    this.editing.set(undefined);
    this.model.set(emptyModel());
    this.itemForm().reset();
    this.error.set(undefined);
    this.saved.set(false);
  }
}
