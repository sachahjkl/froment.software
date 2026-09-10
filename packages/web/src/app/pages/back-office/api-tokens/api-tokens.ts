import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import {
  type ApiTokenPermissionCodeValue,
  type ApiTokenListValue,
  type ApiTokenValue,
  type UlidValue,
} from '@froment/contracts';

import { ApiTokensApi } from '@backoffice/api-tokens-api';
import { RouterLink } from '@angular/router';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { FilterChip } from '@shared/filter-chip/filter-chip';
import { TableExport } from '@shared/table-export/table-export';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { tokenTableOptions } from '../configuration/workspace-tables';
import { ApiTokenNavigation } from './api-token-navigation';

@Component({
  selector: 'app-api-tokens',
  imports: [
    Badge,
    Button,
    DataTable,
    EntityIcon,
    LocalizedDatePipe,
    Notice,
    PageHeader,
    RouterLink,
    TableSort,
    ListToolbar,
    ListWorkspace,
    ListSearch,
    FilterMenu,
    FilterPanel,
    FilterChoice,
    FilterChip,
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry, ApiTokenNavigation],
  templateUrl: './api-tokens.html',
  styleUrl: './api-tokens.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class ApiTokens {
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(ApiTokenNavigation);
  private readonly api = inject(ApiTokensApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tokens = signal<ApiTokenListValue>([]);
  protected readonly table = createWorkspaceTable(this.tokens, tokenTableOptions);
  protected readonly filterCount = computed(() => Number(this.table.query().filter !== 'all'));
  protected readonly tokenExport = computed(() =>
    this.table
      .rows()
      .map((item) => [
        item.name,
        item.permissions.join(', '),
        new Date(item.createdAt).toISOString(),
        new Date(item.expiresAt).toISOString(),
        item.lastUsedAt === null ? null : new Date(item.lastUsedAt).toISOString(),
        this.status(item),
      ]),
  );
  protected readonly nextCursor = signal<UlidValue | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly revoking = signal(false);
  protected readonly pageError = signal<TranslationKey | undefined>(undefined);
  private readonly now = signal(Date.now());
  private expirationTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(() => {
      void this.load();
    });
    this.destroyRef.onDestroy(() => {
      if (this.expirationTimer !== undefined) clearTimeout(this.expirationTimer);
    });
  }

  protected permissionLabel(permission: ApiTokenPermissionCodeValue): TranslationKey {
    return `backOffice.apiTokens.permission.${permission}`;
  }

  protected async revoke(token: ApiTokenValue): Promise<void> {
    if (this.revoking()) return;
    if (!(await this.confirmation.request(this.i18n.t('backOffice.apiTokens.revokeConfirmation'))))
      return;
    this.revoking.set(true);
    this.pageError.set(undefined);
    const outcome = await this.api.revoke(token.id);
    this.revoking.set(false);
    if (!outcome.success) {
      this.pageError.set(outcome.code);
      return;
    }
    this.tokens.update((tokens) =>
      tokens.map((current) => (current.id === outcome.result.id ? outcome.result : current)),
    );
    this.scheduleExpiration();
  }

  protected status(token: ApiTokenValue): 'active' | 'expired' | 'revoked' {
    if (token.revokedAt !== null) return 'revoked';
    return token.expiresAt <= this.now() ? 'expired' : 'active';
  }

  protected statusLabel(token: ApiTokenValue): TranslationKey {
    return `backOffice.apiTokens.status.${this.status(token)}`;
  }

  protected statusVariant(token: ApiTokenValue): BadgeVariant {
    const status = this.status(token);
    if (status === 'active') return 'success';
    if (status === 'expired') return 'warning';
    return 'danger';
  }

  protected date(milliseconds: number): Date {
    return new Date(milliseconds);
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (cursor === null || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.pageError.set(undefined);
    try {
      const page = await this.api.list(cursor);
      this.appendMissingTokens(page.items);
      this.nextCursor.set(page.nextCursor);
      this.scheduleExpiration();
    } catch {
      this.pageError.set('api_token.error');
    } finally {
      this.loadingMore.set(false);
    }
  }

  canDeactivate(): boolean {
    return !this.revoking();
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.revoking()) event.preventDefault();
  }

  private async load(): Promise<void> {
    try {
      const page = await this.api.list();
      this.appendMissingTokens(page.items);
      this.nextCursor.set(page.nextCursor);
      this.scheduleExpiration();
    } catch {
      this.pageError.set('api_token.error');
    } finally {
      this.loading.set(false);
    }
  }

  private appendMissingTokens(items: ApiTokenListValue): void {
    this.tokens.update((tokens) => {
      const known = new Set(tokens.map(({ id }) => id));
      return [...tokens, ...items.filter(({ id }) => !known.has(id))];
    });
  }

  private scheduleExpiration(): void {
    if (this.expirationTimer !== undefined) clearTimeout(this.expirationTimer);
    const now = Date.now();
    this.now.set(now);
    const nextExpiration = this.tokens()
      .filter(({ expiresAt, revokedAt }) => revokedAt === null && expiresAt > now)
      .reduce<number | undefined>(
        (next, { expiresAt }) => (next === undefined || expiresAt < next ? expiresAt : next),
        undefined,
      );
    if (nextExpiration === undefined) {
      this.expirationTimer = undefined;
      return;
    }
    this.expirationTimer = setTimeout(
      () => this.scheduleExpiration(),
      Math.min(nextExpiration - now + 1, 2_147_483_647),
    );
  }
}
