import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { RouterLink, RouterOutlet } from '@angular/router';
import { type ClientSummaryValue } from '@froment/contracts';
import { ClientsApi } from '@backoffice/clients-api';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Badge } from '@shared/badge/badge';
import { Notice } from '@shared/notice/notice';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';
import { PageHeader } from '@shared/page-header/page-header';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { EmptyState } from '@shared/empty-state/empty-state';
import { Icon } from '@shared/icon/icon';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

type ClientTab = 'active' | 'archived' | 'all';

@Component({
  host: { class: 'page-container' },
  selector: 'app-clients',
  imports: [
    Badge,
    Button,
    DataTable,
    FormField,
    Notice,
    RouterLink,
    RouterOutlet,
    TabLayout,
    TabPanel,
    Tabs,
    PageHeader,
    ListToolbar,
    EmptyState,
    Icon,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  protected readonly clients = signal<ReadonlyArray<ClientSummaryValue>>([]);
  protected readonly filters = form(signal({ search: '' }));
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly tabs = computed<readonly TabItem[]>(() =>
    (['active', 'archived', 'all'] as const).map((value) => ({
      path: value,
      id: `clients-${value}-tab`,
      label: this.i18n.t(`backOffice.clients.tab.${value}`),
    })),
  );
  private readonly searchResults = createFuzzySearch(
    this.clients,
    computed(() => this.filters.search().value()),
    {
      keys: ['displayName', 'email', 'city', 'country'],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  private readonly results = computed(() =>
    this.searchResults().map((result) => ({
      client: result.item,
      nameMatches: result.matches?.find((match) => match.key === 'displayName')?.indices ?? [],
      emailMatches: result.matches?.find((match) => match.key === 'email')?.indices ?? [],
    })),
  );
  protected visibleClients(selected: ClientTab) {
    return this.results().filter(
      ({ client }) => selected === 'all' || client.archived === (selected === 'archived'),
    );
  }
  constructor() {
    afterNextRender(() => void this.load());
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      this.clients.set(await this.api.list());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
