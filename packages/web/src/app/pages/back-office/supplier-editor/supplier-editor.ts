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
  FormField,
  form,
  max,
  maxLength,
  min,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Ulid, type SupplierInputValue, type SupplierSummaryValue } from '@froment/contracts';
import { Option, Schema } from 'effect';

import { SuppliersApi } from '@backoffice/suppliers-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

const emptySupplier = (): SupplierInputValue => ({
  displayName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
  phone: '',
  registrationNumber: '',
  vatNumber: '',
  defaultCurrency: 'EUR',
  paymentTermsDays: 30,
  iban: '',
  bic: '',
});

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-editor',
  imports: [Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './supplier-editor.html',
  styleUrl: './supplier-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SuppliersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requestId = crypto.randomUUID();
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly editing = signal(false);
  protected readonly supplier = signal<SupplierSummaryValue | undefined>(undefined);
  protected readonly saving = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly model = signal(emptySupplier());
  protected readonly supplierForm = form(this.model, (path) => {
    required(path.displayName);
    pattern(path.displayName, /\S/);
    maxLength(path.displayName, 160);
    maxLength(path.addressLine1, 160);
    maxLength(path.addressLine2, 160);
    maxLength(path.postalCode, 32);
    maxLength(path.city, 120);
    maxLength(path.country, 120);
    maxLength(path.email, 254);
    pattern(path.email, /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    maxLength(path.phone, 64);
    pattern(path.phone, /^$|^\+?[0-9][0-9 ()\-./]{5,62}$/);
    maxLength(path.registrationNumber, 64);
    maxLength(path.vatNumber, 64);
    required(path.defaultCurrency);
    pattern(path.defaultCurrency, /^[A-Z]{3}$/);
    min(path.paymentTermsDays, 0);
    max(path.paymentTermsDays, 365);
    maxLength(path.iban, 42);
    pattern(path.iban, /^$|^[A-Za-z]{2}[0-9A-Za-z ]{13,40}$/);
    maxLength(path.bic, 11);
    pattern(path.bic, /^$|^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/);
  });
  private loadGeneration = 0;

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
    if (this.completed() || !this.supplierForm().dirty()) return true;
    return this.confirmation.request(this.i18n.t('supplier.unsavedChanges'));
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.supplierForm().dirty()) event.preventDefault();
  }

  protected invalid(field: keyof SupplierInputValue): boolean {
    return this.supplierForm[field]().touched() && this.supplierForm[field]().invalid();
  }

  protected fieldError(field: keyof SupplierInputValue): TranslationKey {
    if (field === 'displayName') return 'supplier.nameInvalid';
    if (field === 'email') return 'supplier.emailInvalid';
    if (field === 'phone') return 'supplier.phoneInvalid';
    if (field === 'defaultCurrency') return 'supplier.currencyInvalid';
    if (field === 'paymentTermsDays') return 'supplier.paymentTermsInvalid';
    if (field === 'iban') return 'supplier.ibanInvalid';
    if (field === 'bic') return 'supplier.bicInvalid';
    return 'supplier.fieldInvalid';
  }

  protected backLink(): readonly string[] {
    const supplier = this.supplier();
    return supplier ? ['/backoffice/suppliers', supplier.id] : ['/backoffice/suppliers'];
  }

  protected listQuery() {
    return { q: this.route.snapshot.queryParamMap.get('q') };
  }

  protected title() {
    return this.i18n.t(this.editing() ? 'supplier.editTitle' : 'supplier.createTitle');
  }

  protected intro() {
    return this.i18n.t(this.editing() ? 'supplier.editIntro' : 'supplier.createIntro');
  }

  protected submitLabel() {
    if (this.saving()) return this.i18n.t('supplier.saving');
    return this.i18n.t(this.editing() ? 'supplier.save' : 'supplier.create');
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const rawId = this.route.snapshot.paramMap.get('supplierId');
    this.editing.set(rawId !== null);
    this.error.set(undefined);
    this.completed.set(false);
    if (rawId === null) {
      this.supplier.set(undefined);
      this.supplierForm().reset(emptySupplier());
      this.state.set('ready');
      return;
    }
    this.state.set('loading');
    const id = Schema.decodeUnknownOption(Ulid)(rawId);
    if (Option.isNone(id)) {
      this.error.set('supplier.not_found');
      this.state.set('error');
      return;
    }
    const outcome = await this.api.get(id.value);
    if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
    if (!outcome.success) {
      this.error.set(outcome.code);
      this.state.set('error');
      return;
    }
    const { id: _id, archived: _archived, updatedAt: _updatedAt, ...input } = outcome.result;
    this.supplier.set(outcome.result);
    this.supplierForm().reset(input);
    this.state.set('ready');
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.state() !== 'ready' || this.supplier()?.archived) return;
    this.supplierForm().markAsTouched();
    if (this.supplierForm().invalid()) {
      this.supplierForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.supplierForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      try {
        const current = this.supplier();
        const outcome = current
          ? await this.api.update(current.id, {
              ...this.model(),
              expectedUpdatedAt: current.updatedAt,
            })
          : await this.api.create({ ...this.model(), requestId: this.requestId });
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.completed.set(true);
        this.supplierForm().reset();
        await this.router.navigate(['/backoffice/suppliers', outcome.result.id], {
          queryParams: this.listQuery(),
        });
      } catch {
        this.error.set('supplier.error');
      } finally {
        this.saving.set(false);
      }
    });
  }
}
