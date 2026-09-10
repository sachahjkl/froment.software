import { Confirmation } from '@shared/confirmation/confirmation';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  disabled,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import {
  ApiTokenPermissionCodes,
  type ApiTokenPermissionCodeValue,
  type ApiTokenListValue,
  type ApiTokenValue,
  type UlidValue,
} from '@froment/contracts';
import type { FuseResultMatch } from 'fuse.js';

import { ApiTokensApi } from '@backoffice/api-tokens-api';
import { Router, RouterLink } from '@angular/router';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { EntityIcon } from '@shared/entity-icon/entity-icon';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { TextCopy } from '@shared/text-copy';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { TableSort } from '@shared/table-sort/table-sort';
import { ListToolbar } from '@shared/list-toolbar/list-toolbar';
import { ListWorkspace } from '@shared/list-toolbar/list-workspace';
import { ListSearch } from '@shared/list-search/list-search';
import { FilterMenu, FilterPanel } from '@shared/filter-menu/filter-menu';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { TableExport } from '@shared/table-export/table-export';
import { createWorkspaceTable } from '../configuration/workspace-table';
import { tokenTableOptions } from '../configuration/workspace-tables';

interface TokenModel {
  readonly name: string;
  readonly expiresAt: string;
  readonly permissions: ReadonlyArray<ApiTokenPermissionCodeValue>;
}

interface PermissionOption {
  readonly code: ApiTokenPermissionCodeValue;
  readonly label: string;
}

interface PermissionResult {
  readonly item: PermissionOption;
  readonly codeMatches: FuseResultMatch['indices'];
  readonly labelMatches: FuseResultMatch['indices'];
}

const noMatches: FuseResultMatch['indices'] = [];

const initialExpiration = () => {
  const date = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const emptyModel = (): TokenModel => ({
  name: '',
  expiresAt: initialExpiration(),
  permissions: [],
});

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
    TableExport,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './api-tokens.html',
  styleUrl: './api-tokens.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class ApiTokens {
  private readonly confirmation = inject(Confirmation);
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ApiTokensApi);
  private readonly textCopy = inject(TextCopy);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly permissionInput = viewChild('permissionSearch', {
    read: ElementRef<HTMLInputElement>,
  });
  protected readonly editor: boolean = false;
  private readonly model = signal<TokenModel>(emptyModel());
  private readonly baseline = signal(JSON.stringify(this.model()));
  protected readonly tokenConfirmation = computed(() =>
    this.i18n.plural('configurationWorkspace.tokenConfirm', {
      name: this.model().name.trim(),
      count: this.model().permissions.length,
    }),
  );
  protected readonly tokenForm = form(this.model, (path) => {
    disabled(path, () => this.saving() || this.secret() !== undefined);
    required(path.name);
    maxLength(path.name, 120);
    pattern(path.name, /\S/);
    required(path.expiresAt);
    minLength(path.permissions, 1);
  });
  // Native validity animations can mark unchanged values dirty. Keep incomplete native input guarded.
  protected readonly hasUnsavedChanges = computed(
    () =>
      JSON.stringify(this.model()) !== this.baseline() ||
      this.tokenForm
        .expiresAt()
        .errors()
        .some((error) => error.kind === 'parse'),
  );
  protected readonly permissionQuery = signal('');
  private readonly permissionOptions = computed<ReadonlyArray<PermissionOption>>(() =>
    ApiTokenPermissionCodes.map((code) => ({
      code,
      label: this.i18n.t(this.permissionLabel(code)),
    })),
  );
  private readonly permissionSearchResults = createFuzzySearch(
    this.permissionOptions,
    this.permissionQuery,
    {
      keys: [
        { name: 'code', weight: 0.45 },
        { name: 'label', weight: 0.55 },
      ],
      ignoreDiacritics: true,
      ignoreLocation: true,
      includeMatches: true,
      threshold: 0.35,
    },
  );
  protected readonly filteredPermissions = computed<ReadonlyArray<PermissionResult>>(() =>
    this.permissionSearchResults().map(({ item, matches = [] }) => ({
      item,
      codeMatches: matches.find(({ key }) => key === 'code')?.indices ?? noMatches,
      labelMatches: matches.find(({ key }) => key === 'label')?.indices ?? noMatches,
    })),
  );
  protected readonly permissionGroups = computed(() =>
    ['client', 'quote', 'order', 'invoice', 'payment', 'document']
      .map((domain) => ({
        domain,
        permissions: this.filteredPermissions().filter(({ item }) =>
          item.code.startsWith(`${domain}.`),
        ),
      }))
      .filter((group) => group.permissions.length > 0),
  );
  protected readonly tokens = signal<ApiTokenListValue>([]);
  protected readonly table = createWorkspaceTable(this.tokens, tokenTableOptions);
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
  protected readonly saving = signal(false);
  protected readonly revoking = signal(false);
  protected readonly pageError = signal<TranslationKey | undefined>(undefined);
  protected readonly dialogError = signal<TranslationKey | undefined>(undefined);
  protected readonly secret = signal<string | undefined>(undefined);
  protected readonly copied = signal(false);
  private readonly now = signal(Date.now());
  private expirationTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    afterNextRender(() => {
      if (!this.editor) void this.load();
    });
    this.destroyRef.onDestroy(() => {
      if (this.expirationTimer !== undefined) clearTimeout(this.expirationTimer);
    });
  }

  protected acknowledgeSecret(): void {
    this.secret.set(undefined);
    this.resetCreate();
    void this.router.navigate(['/backoffice/api'], { queryParams: this.table.params() });
  }

  private resetCreate(): void {
    this.secret.set(undefined);
    this.copied.set(false);
    this.dialogError.set(undefined);
    this.model.set(emptyModel());
    this.baseline.set(JSON.stringify(this.model()));
    this.tokenForm().reset();
  }

  protected togglePermission(permission: ApiTokenPermissionCodeValue, selected: boolean): void {
    if (this.saving() || this.secret()) return;
    this.tokenForm.permissions().markAsDirty();
    this.model.update((model) => ({
      ...model,
      permissions: selected
        ? [...model.permissions, permission]
        : model.permissions.filter((current) => current !== permission),
    }));
  }

  protected updatePermissionQuery(input: HTMLInputElement): void {
    this.permissionQuery.set(input.value.slice(0, 120));
  }

  protected permissionLabel(permission: ApiTokenPermissionCodeValue): TranslationKey {
    return `backOffice.apiTokens.permission.${permission}`;
  }

  protected selected(permission: ApiTokenPermissionCodeValue): boolean {
    return this.model().permissions.includes(permission);
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.secret()) return;
    if (this.tokenForm().invalid() || !this.expirationValid()) {
      this.tokenForm().markAsTouched();
      this.dialogError.set('configurationWorkspace.tokenInvalid');
      if (this.tokenForm.name().invalid()) this.tokenForm.name().focusBoundControl();
      else if (!this.expirationValid()) this.tokenForm.expiresAt().focusBoundControl();
      else this.permissionInput()?.nativeElement.focus();
      return;
    }
    void submit(this.tokenForm, async () => {
      this.saving.set(true);
      if (!(await this.confirmation.request(this.tokenConfirmation()))) {
        this.saving.set(false);
        return;
      }
      this.dialogError.set(undefined);
      const outcome = await this.api.create({
        name: this.model().name.trim(),
        expiresAt: Date.parse(this.model().expiresAt),
        permissions: this.model().permissions,
      });
      this.saving.set(false);
      if (!outcome.success) {
        this.dialogError.set(outcome.code);
        return;
      }
      this.tokens.update((tokens) => [outcome.result.token, ...tokens]);
      this.baseline.set(JSON.stringify(this.model()));
      this.secret.set(outcome.result.secret);
      this.scheduleExpiration();
    });
  }

  protected async copySecret(secret: string): Promise<void> {
    if (await this.textCopy.copy(secret)) {
      this.copied.set(true);
      this.dialogError.set(undefined);
      return;
    }
    this.copied.set(false);
    this.dialogError.set('clipboard.error');
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

  protected expirationValid(): boolean {
    return !this.tokenForm.expiresAt().invalid() && Date.parse(this.model().expiresAt) > Date.now();
  }

  protected createDisabled(): boolean {
    return this.saving() || this.secret() !== undefined;
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

  async canDeactivate(): Promise<boolean> {
    if (this.saving() || this.revoking()) return false;
    if (this.secret() === undefined && !this.hasUnsavedChanges()) return true;
    return this.confirmation.request(
      this.i18n.t(
        this.secret() === undefined
          ? 'configurationWorkspace.unsaved'
          : 'backOffice.apiTokens.leaveConfirmation',
      ),
    );
  }

  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.revoking() || this.secret() !== undefined || this.hasUnsavedChanges())
      event.preventDefault();
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
