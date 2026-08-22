import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormField,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import {
  IntegrationPermissionCodes,
  type IntegrationPermissionCodeValue,
  type IntegrationTokenListValue,
  type IntegrationTokenValue,
  type UlidValue,
} from '@froment/contracts';

import { IntegrationTokensApi } from '@backoffice/integration-tokens-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Badge, type BadgeVariant } from '@shared/badge/badge';
import { Button } from '@shared/button/button';
import { CopyField } from '@shared/copy-field/copy-field';
import { DataTable } from '@shared/data-table/data-table';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { Notice } from '@shared/notice/notice';
import { TextCopy } from '@shared/text-copy';

interface TokenModel {
  readonly name: string;
  readonly expiresAt: string;
  readonly permissions: ReadonlyArray<IntegrationPermissionCodeValue>;
}

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
  selector: 'app-integration-tokens',
  imports: [Badge, Button, CopyField, DataTable, FormField, LocalizedDatePipe, Notice],
  templateUrl: './integration-tokens.html',
  styleUrl: './integration-tokens.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationTokens {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IntegrationTokensApi);
  private readonly textCopy = inject(TextCopy);
  private readonly model = signal<TokenModel>(emptyModel());
  protected readonly tokenForm = form(this.model, (path) => {
    required(path.name);
    maxLength(path.name, 120);
    pattern(path.name, /\S/);
    required(path.expiresAt);
    minLength(path.permissions, 1);
  });
  protected readonly permissionCodes = IntegrationPermissionCodes;
  protected readonly tokens = signal<IntegrationTokenListValue>([]);
  protected readonly loading = signal(true);
  protected readonly createOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly pendingTokenId = signal<UlidValue | undefined>(undefined);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly secret = signal<string | undefined>(undefined);
  protected readonly copied = signal(false);
  private readonly createButton = viewChild.required('createButton', { read: ElementRef });
  private readonly createDialog = viewChild.required<ElementRef<HTMLDialogElement>>('createDialog');
  private createWasOpen = false;
  private tokensRevision = 0;

  constructor() {
    afterNextRender(() => void this.load());
    afterRenderEffect({
      write: () => {
        const open = this.createOpen();
        const dialog = this.createDialog().nativeElement;
        if (open && !this.createWasOpen) {
          if (!dialog.open) dialog.showModal();
          dialog.querySelector<HTMLInputElement>('input')?.focus();
        } else if (!open && this.createWasOpen) {
          if (dialog.open) dialog.close();
          this.createButton().nativeElement.focus();
        }
        this.createWasOpen = open;
      },
    });
  }

  protected openCreate(): void {
    this.error.set(undefined);
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    this.secret.set(undefined);
    this.copied.set(false);
    this.model.set(emptyModel());
    this.tokenForm().reset();
    this.createOpen.set(false);
  }

  protected togglePermission(permission: IntegrationPermissionCodeValue, selected: boolean): void {
    this.model.update((model) => ({
      ...model,
      permissions: selected
        ? [...model.permissions, permission]
        : model.permissions.filter((current) => current !== permission),
    }));
  }

  protected selected(permission: IntegrationPermissionCodeValue): boolean {
    return this.model().permissions.includes(permission);
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.expirationValid()) return;
    void submit(this.tokenForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      const outcome = await this.api.create({
        name: this.model().name.trim(),
        expiresAt: Date.parse(this.model().expiresAt),
        permissions: this.model().permissions,
      });
      this.saving.set(false);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.tokensRevision++;
      this.tokens.update((tokens) => [outcome.result.token, ...tokens]);
      this.secret.set(outcome.result.secret);
    });
  }

  protected async copySecret(secret: string): Promise<void> {
    if (await this.textCopy.copy(secret)) {
      this.copied.set(true);
      return;
    }
    this.error.set('clipboard.error');
  }

  protected async revoke(token: IntegrationTokenValue): Promise<void> {
    if (!globalThis.confirm(this.i18n.t('backOffice.integrationTokens.revokeConfirmation'))) return;
    this.pendingTokenId.set(token.id);
    this.error.set(undefined);
    const outcome = await this.api.revoke(token.id);
    this.pendingTokenId.set(undefined);
    if (!outcome.success) {
      this.error.set(outcome.code);
      return;
    }
    this.tokensRevision++;
    this.tokens.update((tokens) =>
      tokens.map((current) => (current.id === outcome.result.id ? outcome.result : current)),
    );
  }

  protected status(token: IntegrationTokenValue): 'active' | 'expired' | 'revoked' {
    if (token.revokedAt !== null) return 'revoked';
    return token.expiresAt <= Date.now() ? 'expired' : 'active';
  }

  protected expirationValid(): boolean {
    return Date.parse(this.model().expiresAt) > Date.now();
  }

  protected createDisabled(): boolean {
    return this.saving() || this.tokenForm().invalid() || !this.expirationValid();
  }

  protected statusLabel(token: IntegrationTokenValue): TranslationKey {
    return `backOffice.integrationTokens.status.${this.status(token)}`;
  }

  protected statusVariant(token: IntegrationTokenValue): BadgeVariant {
    const status = this.status(token);
    if (status === 'active') return 'success';
    if (status === 'expired') return 'warning';
    return 'danger';
  }

  protected date(milliseconds: number): Date {
    return new Date(milliseconds);
  }

  private async load(): Promise<void> {
    const revision = this.tokensRevision;
    try {
      const tokens = await this.api.list();
      if (revision === this.tokensRevision) this.tokens.set(tokens);
    } catch {
      this.error.set('integration_token.error');
    } finally {
      this.loading.set(false);
    }
  }
}
