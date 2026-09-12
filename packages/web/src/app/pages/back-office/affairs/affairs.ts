import { Can } from '@backoffice/can';
import { AffairsApi } from '@backoffice/affairs-api';
import { ClientsApi } from '@backoffice/clients-api';
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
import { form, FormField, maxLength, required } from '@angular/forms/signals';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  AffairCreateRequest,
  type AffairList,
  type ClientListValue,
  Ulid,
} from '@froment/contracts';
import { Schema } from 'effect';
import { filter } from 'rxjs';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs, type TabItem } from '@shared/tabs/tabs';
import { TabLayout, TabPanel } from '@shared/tabs/tab-panel';

type AffairView = 'attention' | 'active' | 'completed' | 'all';

@Component({
  host: { class: 'page-container' },
  selector: 'app-affairs',
  imports: [
    Can,
    Badge,
    Button,
    DataTable,
    FormField,
    Notice,
    PageHeader,
    RouterLink,
    RouterOutlet,
    Tabs,
    TabLayout,
    TabPanel,
  ],
  templateUrl: './affairs.html',
  styleUrl: './affairs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Affairs {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(AffairsApi);
  private readonly clientsApi = inject(ClientsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly affairs = signal<typeof AffairList.Type>([]);
  protected readonly clients = signal<ClientListValue>([]);
  protected readonly view = signal<AffairView>('attention');
  private readonly model = signal({ clientId: '', title: '' });
  protected readonly createForm = form(this.model, (path) => {
    required(path.clientId);
    required(path.title);
    maxLength(path.title, 160);
  });
  protected readonly saving = signal(false);
  protected readonly tabs = computed<readonly TabItem[]>(() => [
    this.tab('attention', 'backOffice.affairs.attention'),
    this.tab('active', 'backOffice.affairs.active'),
    this.tab('completed', 'backOffice.affairs.completed'),
    this.tab('all', 'backOffice.affairs.all'),
  ]);
  protected readonly visible = computed(() => {
    const view = this.view();
    return this.affairs().filter((affair) => {
      if (view === 'all') return true;
      if (view === 'completed') return affair.status === 'closed';
      if (view === 'attention') return affair.status === 'open' && affair.quoteIds.length === 0;
      return affair.status === 'open';
    });
  });

  constructor() {
    afterNextRender(() => {
      this.readView();
      this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => this.readView());
      void this.load();
    });
  }

  private readView(): void {
    const path = this.route.firstChild?.snapshot.url[0]?.path;
    this.view.set(path === 'active' || path === 'completed' || path === 'all' ? path : 'attention');
  }

  protected async load(): Promise<void> {
    this.state.set('loading');
    try {
      const [affairs, clients] = await Promise.all([this.api.list(), this.clientsApi.list()]);
      if (!affairs.success) {
        this.state.set('error');
        return;
      }
      this.affairs.set(affairs.result);
      this.clients.set(clients.filter((client) => !client.archived));
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    if (this.createForm().invalid() || this.saving()) return;
    this.saving.set(true);
    try {
      const value = this.model();
      const result = await this.api.create(
        AffairCreateRequest.make({
          requestId: crypto.randomUUID(),
          clientId: Schema.decodeUnknownSync(Ulid)(value.clientId),
          title: value.title.trim(),
        }),
      );
      if (!result.success) {
        this.state.set('error');
        return;
      }
      this.affairs.update((items) => [result.result, ...items]);
      this.createForm().reset({ clientId: '', title: '' });
      await this.router.navigate(['/backoffice/affairs', result.result.id]);
    } finally {
      this.saving.set(false);
    }
  }

  private tab(path: AffairView, label: TranslationKey): TabItem {
    return { path, id: `affairs-${path}-tab`, label: this.i18n.t(label) };
  }
}
