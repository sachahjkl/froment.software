import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  disabled,
  form,
  FormField,
  maxLength,
  minLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { Router, RouterLink } from '@angular/router';
import { ApiTokenPermissionCodes, type ApiTokenPermissionCodeValue } from '@froment/contracts';
import { ApiTokensApi } from '@backoffice/api-tokens-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { CopyField } from '@shared/copy-field/copy-field';
import { TextCopy } from '@shared/text-copy';
import {
  PermissionPicker,
  type PermissionSelectionChange,
} from '@shared/permission-picker/permission-picker';
import { ApiTokenNavigation } from './api-token-navigation';
import { apiTokenErrorMessage } from './api-token-error-message';

interface TokenModel {
  readonly name: string;
  readonly expiresAt: string;
  readonly permissions: ReadonlyArray<ApiTokenPermissionCodeValue>;
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
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
  imports: [FormField, RouterLink, Button, Notice, CopyField, PermissionPicker, PageHeader],
  providers: [ApiTokenNavigation],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-api-token-editor',
  styleUrl: './api-token-editor.scss',
  templateUrl: './api-token-editor.html',
})
export class ApiTokenEditor {
  protected readonly i18n = inject(I18nService);
  protected readonly navigation = inject(ApiTokenNavigation);
  private readonly confirmation = inject(Confirmation);
  private readonly api = inject(ApiTokensApi);
  private readonly textCopy = inject(TextCopy);
  private readonly router = inject(Router);
  private readonly permissionPicker = viewChild(PermissionPicker);
  private readonly secretHeading = viewChild('secretHeading', { read: ElementRef<HTMLElement> });
  private readonly model = signal<TokenModel>(emptyModel());
  private readonly baseline = signal(JSON.stringify(this.model()));
  protected readonly saving = signal(false);
  protected readonly dialogError = signal<TranslationKey | undefined>(undefined);
  protected readonly errorMessage = computed(() =>
    apiTokenErrorMessage(this.dialogError(), 'create'),
  );
  protected readonly secret = signal<string | undefined>(undefined);
  protected readonly copied = signal(false);
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
  // Les animations de validité peuvent marquer une valeur inchangée comme modifiée.
  protected readonly hasUnsavedChanges = computed(
    () =>
      JSON.stringify(this.model()) !== this.baseline() ||
      this.tokenForm
        .expiresAt()
        .errors()
        .some((error) => error.kind === 'parse'),
  );
  protected readonly permissionOptions = computed(() =>
    ApiTokenPermissionCodes.map((code) => ({
      code,
      label: this.i18n.t(`backOffice.apiTokens.permission.${code}`),
    })),
  );

  constructor() {
    afterRenderEffect(() => {
      if (this.secret()) this.secretHeading()?.nativeElement.focus();
    });
  }

  protected acknowledgeSecret(): void {
    this.secret.set(undefined);
    this.copied.set(false);
    this.dialogError.set(undefined);
    this.model.set(emptyModel());
    this.baseline.set(JSON.stringify(this.model()));
    this.tokenForm().reset();
    void this.router.navigate(['/backoffice/api'], { queryParams: this.navigation.params() });
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

  protected changePermission(change: PermissionSelectionChange): void {
    const permission = ApiTokenPermissionCodes.find((code) => code === change.code);
    if (permission === undefined) return;
    this.togglePermission(permission, change.selected);
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.secret()) return;
    if (this.tokenForm().invalid() || !this.expirationValid()) {
      this.tokenForm().markAsTouched();
      this.dialogError.set('configurationWorkspace.tokenInvalid');
      if (this.tokenForm.name().invalid()) this.tokenForm.name().focusBoundControl();
      else if (!this.expirationValid()) this.tokenForm.expiresAt().focusBoundControl();
      else this.permissionPicker()?.focusSearch();
      return;
    }
    void submit(this.tokenForm, async () => {
      this.saving.set(true);
      try {
        if (!(await this.confirmation.request(this.tokenConfirmation()))) return;
        this.dialogError.set(undefined);
        const outcome = await this.api.create({
          name: this.model().name.trim(),
          expiresAt: Date.parse(this.model().expiresAt),
          permissions: this.model().permissions,
        });
        if (!outcome.success) {
          this.dialogError.set(outcome.code);
          return;
        }
        this.baseline.set(JSON.stringify(this.model()));
        this.secret.set(outcome.result.secret);
      } finally {
        this.saving.set(false);
      }
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

  protected expirationValid(): boolean {
    return !this.tokenForm.expiresAt().invalid() && Date.parse(this.model().expiresAt) > Date.now();
  }

  protected createDisabled(): boolean {
    return this.saving() || this.secret() !== undefined;
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
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
    if (this.saving() || this.secret() !== undefined || this.hasUnsavedChanges())
      event.preventDefault();
  }
}
