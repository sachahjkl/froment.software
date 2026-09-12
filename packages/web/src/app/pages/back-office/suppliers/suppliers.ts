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
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import type { SupplierSummaryValue } from '@froment/contracts';

import { SuppliersApi } from '@backoffice/suppliers-api';
import { I18nService } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { Can } from '@backoffice/can';
import { DataTable } from '@shared/data-table/data-table';
import { EmptyState } from '@shared/empty-state/empty-state';
import { Icon } from '@shared/icon/icon';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { Tabs, type TabItem } from '@shared/tabs/tabs';

type SupplierView = 'active' | 'archived' | 'all';

@Component({
  host: { class: 'page-container' },
  selector: 'app-suppliers',
  imports: [
    Badge,
    Button,
    Can,
    DataTable,
    EmptyState,
    Icon,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
  ],
  templateUrl: './suppliers.html',
  styleUrl: './suppliers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Suppliers {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(SuppliersApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadGeneration = 0;
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly suppliers = signal<ReadonlyArray<SupplierSummaryValue>>([]);
  protected readonly query = signal(
    this.route.snapshot.queryParamMap.get('q')?.slice(0, 120) ?? '',
  );
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['active', 'archived', 'all'] as const).map((view) => ({
      path: view,
      id: `suppliers-${view}-tab`,
      label: this.i18n.t(`supplier.tab.${view}`),
    })),
  );
  private readonly collator = computed(
    () => new Intl.Collator(this.i18n.language(), { numeric: true, sensitivity: 'base' }),
  );

  constructor() {
    afterNextRender(() => {
      this.route.queryParamMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((params) => this.query.set(params.get('q')?.slice(0, 120) ?? ''));
      void this.load();
    });
  }

  protected visible(view: SupplierView): ReadonlyArray<SupplierSummaryValue> {
    const query = this.query().trim().toLocaleLowerCase(this.i18n.language());
    return this.suppliers()
      .filter(
        (supplier) =>
          (view === 'all' || supplier.archived === (view === 'archived')) &&
          (query === '' ||
            [
              supplier.displayName,
              supplier.email,
              supplier.city,
              supplier.country,
              supplier.registrationNumber,
              supplier.vatNumber,
            ].some((value) => value.toLocaleLowerCase(this.i18n.language()).includes(query))),
      )
      .toSorted((left, right) => this.collator().compare(left.displayName, right.displayName));
  }

  protected setQuery(event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    const value = event.currentTarget.value.slice(0, 120);
    this.query.set(value);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: value || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected clearQuery(input: HTMLInputElement): void {
    input.value = '';
    this.query.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    input.focus();
  }

  protected statusVariant(supplier: SupplierSummaryValue): BadgeVariant {
    return supplier.archived ? 'warning' : 'success';
  }

  protected statusLabel(supplier: SupplierSummaryValue) {
    return this.i18n.t(supplier.archived ? 'supplier.archived' : 'supplier.active');
  }

  protected emptyTitle() {
    return this.i18n.t(this.query() ? 'supplier.noMatches' : 'supplier.empty');
  }

  protected emptyIntro() {
    return this.i18n.t(this.query() ? 'supplier.changeSearch' : 'supplier.emptyIntro');
  }

  protected detailQuery() {
    return { q: this.query() || null };
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.state.set('loading');
    try {
      const suppliers = await this.api.list();
      if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
      this.suppliers.set(suppliers);
      this.state.set('ready');
    } catch {
      if (generation === this.loadGeneration && !this.destroyRef.destroyed) this.state.set('error');
    }
  }
}
