import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Checkout } from './checkout';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

@Component({
  host: { class: 'page-container' },
  imports: [
    Button,
    Notice,
    RouterLink,
    DataTable,
    LocalizedDatePipe,
    TableSort,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-checkout-list',
  styleUrl: './checkout-list.scss',
  templateUrl: './checkout-list.html',
})
export class CheckoutList extends Checkout {
  protected override readonly task = false;
  protected readonly testExport = computed(() =>
    this.table
      .rows()
      .map((item) => [item.invoiceNumber, item.createdAt, item.amountCents, item.status]),
  );
}
