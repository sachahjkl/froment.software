import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injectable,
  input,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, type ParamMap, Router } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { DateRangeFilter, type DateRange } from '@shared/date-range-filter/date-range-filter';
import { type EntrySort } from './entry-list';
import { readBillingPeriod } from './billing-period';

const readFilters = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 160),
  status: params.get('status') ?? '',
  client: params.get('client') ?? '',
  ...readBillingPeriod(params),
});
export interface BillingEntry {
  readonly invoiceNumber: string | null;
  readonly title: string;
  readonly clientId: string;
  readonly clientDisplayName: string;
  readonly orderReference: string;
  readonly reference?: string;
  readonly number?: string;
  readonly cancelledAt?: string | null;
}
@Injectable()
export class EntryFilterState {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly params = signal(this.route.snapshot.queryParamMap);
  readonly fields = form(signal(readFilters(this.route.snapshot.queryParamMap)));
  readonly periodSummary = computed(() => {
    const { from, to } = this.fields().value();
    return (
      [
        from ? `${this.i18n.t('dateRangeFilter.from')} : ${from}` : '',
        to ? `${this.i18n.t('dateRangeFilter.to')} : ${to}` : '',
      ]
        .filter(Boolean)
        .join(' · ') || this.i18n.t('billingWorkspace.all')
    );
  });
  readonly active = computed(() => {
    const values = this.fields().value();
    const filters = Object.entries(values).filter(
      ([key, value]) => key !== 'from' && key !== 'to' && value !== '',
    );
    if (values.from || values.to) filters.push(['period', this.periodSummary()]);
    return filters;
  });
  readonly filterCount = computed(() => this.active().filter(([key]) => key !== 'q').length);
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.params.set(params);
      this.fields().reset(readFilters(params));
    });
  }
  update(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.fields().value(),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  setSearch(value: string): void {
    this.fields.q().value.set(value.slice(0, 160));
    this.update();
  }
  applyPeriod(range: DateRange): void {
    this.fields().reset({
      ...this.fields().value(),
      from: range.from ?? '',
      to: range.to ?? '',
    });
    this.update();
  }
  updateSort(sort: EntrySort): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.fields().value(), sort },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  clear(key?: string): void {
    this.fields().reset(
      key === undefined
        ? { q: '', status: '', client: '', from: '', to: '' }
        : key === 'period'
          ? { ...this.fields().value(), from: '', to: '' }
          : { ...this.fields().value(), [key]: '' },
    );
    this.update();
  }
  passes(entry: BillingEntry, date: string): boolean {
    const { status, client, from, to } = this.fields().value();
    return (
      (!client || entry.clientId === client) &&
      (!from || date >= from) &&
      (!to || date <= to) &&
      (!status || (status === 'cancelled' ? entry.cancelledAt != null : entry.cancelledAt === null))
    );
  }
}
@Component({
  selector: 'app-billing-entry-filters',
  imports: [
    FormField,
    Button,
    ListToolbar,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    DateRangeFilter,
  ],
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-list-toolbar>
      <app-list-search
        listSearch
        [label]="i18n.t('billingWorkspace.search')"
        [value]="state.fields.q().value()"
        (valueChange)="state.setSearch($event)"
      />
      <app-filter-menu
        #menu
        listFilters
        [label]="i18n.t('listWorkspace.filters')"
        [closeLabel]="i18n.t('listWorkspace.closeFilters')"
        [backLabel]="i18n.t('listWorkspace.backFilters')"
        [activeCount]="state.filterCount()"
        [disabled]="disabled()"
      >
        <ng-template
          appFilterPanel
          [label]="i18n.t('backOffice.invoices.client')"
          [summary]="label('client', state.fields.client().value())"
        >
          <app-filter-choice
            [label]="i18n.t('listWorkspace.searchChoices')"
            [emptyLabel]="i18n.t('listWorkspace.noChoices')"
            [options]="clientOptions()"
            [formField]="state.fields.client"
            (committed)="state.update(); menu.close()"
          />
        </ng-template>
        @if (showStatus()) {
          <ng-template
            appFilterPanel
            [label]="i18n.t('billingWorkspace.financialStatus')"
            [summary]="label('status', state.fields.status().value())"
          >
            <app-filter-choice
              [label]="i18n.t('listWorkspace.searchChoices')"
              [emptyLabel]="i18n.t('listWorkspace.noChoices')"
              [options]="statusOptions()"
              [formField]="state.fields.status"
              (committed)="state.update(); menu.close()"
            />
          </ng-template>
        }
        <ng-template appFilterPanel [label]="periodLabel()" [summary]="state.periodSummary()">
          <app-date-range-filter
            [from]="state.fields.from().value() || undefined"
            [to]="state.fields.to().value() || undefined"
            (rangeApplied)="state.applyPeriod($event); menu.close()"
          />
        </ng-template>
      </app-filter-menu>
      <div listActions><ng-content select="[listActions]" /></div>
    </app-list-toolbar>
    @if (state.active().length) {
      <div class="chips">
        @for (filter of state.active(); track filter[0]) {
          <button
            appButton
            type="button"
            (click)="state.clear(filter[0])"
            [attr.aria-label]="
              i18n.t('billingWorkspace.removeFilter') + ' : ' + label(filter[0], filter[1])
            "
          >
            {{ label(filter[0], filter[1]) }} ×
          </button>
        }
        <button appButton type="button" (click)="state.clear()">
          {{ i18n.t('billingWorkspace.clear') }}
        </button>
      </div>
    }`,
  styles: `
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--space-3);
    }
  `,
})
export class EntryFilters {
  protected readonly state = inject(EntryFilterState);
  protected readonly i18n = inject(I18nService);
  readonly clients = input.required<ReadonlyArray<readonly [string, string]>>();
  readonly periodLabel = input.required<string>();
  readonly showStatus = input(true);
  readonly disabled = input(false);
  protected readonly clientOptions = computed(() => [
    { value: '', label: this.i18n.t('billingWorkspace.all') },
    ...this.clients().map(([value, label]) => ({ value, label })),
  ]);
  protected readonly statusOptions = computed(() =>
    ['', 'active', 'cancelled'].map((value) => ({ value, label: this.label('status', value) })),
  );
  protected label(key: string, value: string): string {
    if (value === '') return this.i18n.t('billingWorkspace.all');
    if (key === 'client') return this.clients().find(([id]) => id === value)?.[1] ?? value;
    if (key === 'status')
      return this.i18n.t(
        value === 'cancelled' ? 'billingWorkspace.cancelled' : 'billingWorkspace.active',
      );
    return value;
  }
}
