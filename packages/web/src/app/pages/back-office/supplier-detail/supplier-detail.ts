import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Ulid, type SupplierSummaryValue } from '@froment/contracts';
import { Option, Schema } from 'effect';

import { Can } from '@backoffice/can';
import { SuppliersApi } from '@backoffice/suppliers-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  host: { class: 'page-container' },
  selector: 'app-supplier-detail',
  imports: [Badge, Button, Can, Notice, PageHeader, RouterLink],
  templateUrl: './supplier-detail.html',
  styleUrl: './supplier-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupplierDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SuppliersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmation = inject(Confirmation);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly supplier = signal<SupplierSummaryValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly changing = signal(false);
  protected readonly taxTreatmentLabel = computed<TranslationKey>(() => {
    const treatment = this.supplier()?.taxTreatment;
    if (treatment === 'eu-reverse-charge') return 'supplier.taxTreatment.eu';
    if (treatment === 'non-eu-import') return 'supplier.taxTreatment.import';
    if (treatment === 'foreign-local-tax') return 'supplier.taxTreatment.local';
    return 'supplier.taxTreatment.france';
  });
  private loadGeneration = 0;

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  protected listQuery() {
    return { q: this.route.snapshot.queryParamMap.get('q') };
  }

  protected statusLabel() {
    return this.i18n.t(this.supplier()?.archived ? 'supplier.archived' : 'supplier.active');
  }

  protected statusVariant() {
    return this.supplier()?.archived ? 'warning' : 'success';
  }

  protected archiveLabel() {
    return this.i18n.t(this.supplier()?.archived ? 'supplier.reactivate' : 'supplier.archive');
  }

  protected date(value: number): string {
    return new Intl.DateTimeFormat(this.i18n.language(), {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value);
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    this.error.set(undefined);
    const id = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('supplierId'));
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
    this.supplier.set(outcome.result);
    this.state.set('ready');
  }

  protected async changeArchive(): Promise<void> {
    const supplier = this.supplier();
    if (!supplier || this.changing()) return;
    const message = supplier.archived ? 'supplier.confirmReactivate' : 'supplier.confirmArchive';
    if (!(await this.confirmation.request(this.i18n.t(message)))) return;
    this.changing.set(true);
    this.error.set(undefined);
    try {
      const outcome = supplier.archived
        ? await this.api.reactivate(supplier.id)
        : await this.api.archive(supplier.id);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.supplier.set(outcome.result);
    } catch {
      this.error.set('supplier.error');
    } finally {
      this.changing.set(false);
    }
  }
}
