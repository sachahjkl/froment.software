import { DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CatalogItemCreateRequest, Ulid, type CatalogItemValue } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { CatalogApi } from '@backoffice/catalog-api';
import { formatFixedDecimal, parseFixedDecimal } from '@backoffice/quote-input';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import {
  catalogFilterQuery,
  catalogListQuery,
  catalogReturnView,
} from '../catalog/catalog-list-query';

const emptyItem = () => ({
  description: '',
  quantity: '1.000',
  unitPrice: '0.00',
  vatRate: '20.00',
  archived: false,
});
type ItemField = 'description' | 'quantity' | 'unitPrice' | 'vatRate';

@Component({
  host: { '[class.page-container]': '!dialog', '[class.editor-dialog]': '!!dialog' },
  selector: 'app-catalog-editor',
  imports: [Badge, Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './catalog-editor.html',
  styleUrl: './catalog-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogEditor {
  protected readonly dialog = inject<DialogRef<CatalogItemValue>>(DialogRef, { optional: true });
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(CatalogApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(Confirmation);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly item = signal<CatalogItemValue | undefined>(undefined);
  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  private readonly confirming = signal(false);
  protected readonly completed = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal(emptyItem());
  protected readonly amounts = [
    {
      field: 'quantity',
      label: 'catalog.quantity',
      error: 'catalogWorkspace.quantityInvalid',
      id: 'catalog-quantity',
    },
    {
      field: 'unitPrice',
      label: 'catalog.price',
      error: 'catalogWorkspace.priceInvalid',
      id: 'catalog-price',
    },
    {
      field: 'vatRate',
      label: 'catalog.tax',
      error: 'catalogWorkspace.taxInvalid',
      id: 'catalog-tax',
    },
  ] as const;
  protected readonly itemForm = form(this.model, (path) => {
    disabled(
      path,
      () => this.saving() || this.completed() || this.uncertain() || this.state() !== 'ready',
    );
    required(path.description);
    maxLength(path.description, 160);
    pattern(path.description, /\S/);
    validate(path.quantity, ({ value }) =>
      Schema.is(CatalogItemCreateRequest.fields.quantityMilli)(parseFixedDecimal(value(), 3))
        ? undefined
        : { kind: 'quantity' },
    );
    validate(path.unitPrice, ({ value }) =>
      Schema.is(CatalogItemCreateRequest.fields.unitPriceCents)(parseFixedDecimal(value(), 2))
        ? undefined
        : { kind: 'price' },
    );
    validate(path.vatRate, ({ value }) =>
      Schema.is(CatalogItemCreateRequest.fields.vatRateBasisPoints)(parseFixedDecimal(value(), 2))
        ? undefined
        : { kind: 'tax' },
    );
  });
  private loadGeneration = 0;

  constructor() {
    if (this.dialog) {
      this.state.set('ready');
      this.dialog.backdropClick
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.close());
      this.dialog.keydownEvents.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          void this.close();
        }
      });
      return;
    }
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  protected backLink() {
    return ['/backoffice/catalogue', catalogReturnView(this.route.snapshot.queryParamMap)];
  }

  protected backQuery() {
    return catalogFilterQuery(catalogListQuery(this.route.snapshot.queryParamMap));
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving() || this.confirming()) return false;
    if (!this.uncertain() && !this.itemForm().dirty()) return true;
    this.confirming.set(true);
    try {
      return await this.confirmation.request(
        this.i18n.t(this.uncertain() ? 'referenceEditor.leaveUncertain' : 'catalog.unsavedChanges'),
      );
    } finally {
      this.confirming.set(false);
    }
  }

  protected async close(): Promise<void> {
    if (this.dialog && (await this.canDeactivate()) && !this.destroyRef.destroyed)
      this.dialog.close();
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.confirming() || this.uncertain() || this.itemForm().dirty())
      event.preventDefault();
  }

  protected invalid(field: ItemField): boolean {
    return this.itemForm[field]().invalid() && this.itemForm[field]().touched();
  }

  protected async load(): Promise<void> {
    if (this.saving() || this.confirming() || this.uncertain()) return;
    const generation = ++this.loadGeneration;
    const id = this.route.snapshot.paramMap.get('itemId');
    this.editing.set(id !== null);
    this.state.set('loading');
    this.error.set(undefined);
    this.item.set(undefined);
    this.completed.set(false);
    this.model.set(emptyItem());
    this.itemForm().reset();
    if (id === null) {
      this.state.set('ready');
      return;
    }
    const decoded = Schema.decodeUnknownOption(Ulid)(id);
    if (Option.isNone(decoded)) {
      this.state.set('error');
      this.error.set('catalog.not_found');
      return;
    }
    try {
      const items = await this.api.list();
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      const item = items.find((candidate) => candidate.id === decoded.value);
      if (item === undefined) {
        this.state.set('error');
        this.error.set('catalog.not_found');
        return;
      }
      this.item.set(item);
      this.model.set({
        description: item.description,
        quantity: formatFixedDecimal(item.quantityMilli, 3),
        unitPrice: formatFixedDecimal(item.unitPriceCents, 2),
        vatRate: formatFixedDecimal(item.vatRateBasisPoints, 2),
        archived: item.archived,
      });
      this.itemForm().reset();
      this.state.set('ready');
    } catch {
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      this.state.set('error');
      this.error.set('catalogWorkspace.loadError');
    }
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (
      this.saving() ||
      this.confirming() ||
      this.completed() ||
      this.uncertain() ||
      this.state() !== 'ready'
    )
      return;
    this.itemForm().markAsTouched();
    if (this.itemForm().invalid()) {
      for (const field of ['description', 'quantity', 'unitPrice', 'vatRate'] as const) {
        if (this.itemForm[field]().invalid()) {
          this.itemForm[field]().focusBoundControl();
          break;
        }
      }
      return;
    }
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
      const item = this.item();
      this.error.set(undefined);
      try {
        if (item && item.archived !== model.archived) {
          this.confirming.set(true);
          const accepted = await this.confirmation.request(
            this.i18n.t(
              model.archived
                ? 'catalogWorkspace.archiveConfirmation'
                : 'catalogWorkspace.restoreConfirmation',
            ),
          );
          this.confirming.set(false);
          if (!accepted || this.destroyRef.destroyed) return;
        }
        this.saving.set(true);
        const outcome = item
          ? await this.api.update(item.id, {
              ...request.value,
              expectedVersion: item.version,
              archived: model.archived,
            })
          : await this.api.create(request.value);
        if (this.destroyRef.destroyed) return;
        if (!outcome.success) {
          if (!item && outcome.code === 'catalog.error') {
            this.uncertain.set(true);
            this.error.set('referenceEditor.catalogUncertain');
          } else this.error.set(outcome.code);
          return;
        }
        this.item.set(outcome.result);
        this.itemForm().reset();
        this.completed.set(true);
      } catch {
        if (!this.destroyRef.destroyed) {
          this.uncertain.set(!item);
          this.error.set(item ? 'catalog.error' : 'referenceEditor.catalogUncertain');
        }
      } finally {
        this.confirming.set(false);
        this.saving.set(false);
      }
      if (this.completed()) {
        if (this.dialog) this.dialog.close(this.item());
        else
          await this.router.navigate(this.backLink(), {
            queryParams: this.backQuery(),
            state: { catalogSaved: true },
          });
      }
    });
  }
}
