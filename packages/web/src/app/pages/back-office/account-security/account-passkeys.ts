import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  Injector,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { disabled, form, FormField, maxLength, required } from '@angular/forms/signals';
import { Passkey, PasskeyList, accountPasswordConfig } from '@froment/contracts';
import { Passkeys } from '@backoffice/passkeys';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { passkeyErrorMessage, type PasskeyOperation } from './account-error-message';

@Component({
  selector: 'app-account-passkeys',
  imports: [Button, Notice, FormField, PageHeader],
  templateUrl: './account-passkeys.html',
  styleUrl: './account-passkeys.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:beforeunload)': 'beforeUnload($event)' },
})
export class AccountPasskeys {
  readonly busy = model(false);
  readonly disabled = input(false);
  protected readonly i18n = inject(I18nService);
  protected readonly api = inject(Passkeys);
  private readonly confirmation = inject(Confirmation);
  private readonly injector = inject(Injector);
  private readonly operationStatus = viewChild('operationStatus', {
    read: ElementRef<HTMLElement>,
  });
  protected readonly keys = signal<typeof PasskeyList.Type>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly errorOperation = signal<PasskeyOperation>('load');
  protected readonly errorMessage = computed(() =>
    passkeyErrorMessage(this.error(), this.errorOperation()),
  );
  protected readonly status = signal<TranslationKey | undefined>(undefined);
  private readonly values = signal({ name: '', password: '' });
  protected readonly fields = form(this.values, (path) => {
    disabled(path, () => this.busy() || this.disabled());
    required(path.name);
    maxLength(path.name, 80);
    required(path.password);
    maxLength(path.password, accountPasswordConfig.maxLength);
  });

  constructor() {
    afterNextRender(() => {
      void this.reload();
    });
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    const outcome = await this.api.list();
    if (outcome.success) this.keys.set(outcome.result);
    else {
      this.errorOperation.set('load');
      this.error.set(outcome.code);
    }
    this.loading.set(false);
  }

  protected async add(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.busy() || this.disabled() || this.loading()) return;
    if (this.fields().invalid()) {
      this.fields().markAsTouched();
      this.fields().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    this.busy.set(true);
    this.error.set(undefined);
    this.status.set(undefined);
    try {
      const outcome = await this.api.register(this.values());
      if (outcome.success) {
        this.status.set('passkey.added');
        await this.reload();
        afterNextRender(() => this.operationStatus()?.nativeElement.focus(), {
          injector: this.injector,
        });
      } else {
        this.errorOperation.set('add');
        this.error.set(outcome.code);
      }
    } finally {
      this.values.set({ name: '', password: '' });
      this.fields().reset();
      if (event.target instanceof HTMLFormElement) event.target.reset();
      this.busy.set(false);
    }
  }

  protected async remove(key: typeof Passkey.Type): Promise<void> {
    if (this.busy() || this.disabled()) return;
    if (this.fields.password().invalid()) {
      this.fields.password().markAsTouched();
      this.fields.password().focusBoundControl();
      return;
    }
    if (
      !(await this.confirmation.request(this.i18n.t('passkey.remove_confirm'), {
        variant: 'danger',
      }))
    )
      return;
    this.busy.set(true);
    this.error.set(undefined);
    this.status.set(undefined);
    try {
      const outcome = await this.api.remove(key.id, { password: this.values().password });
      if (outcome.success) {
        this.status.set('passkey.removed');
        await this.reload();
        afterNextRender(() => this.operationStatus()?.nativeElement.focus(), {
          injector: this.injector,
        });
      } else {
        this.errorOperation.set('remove');
        this.error.set(outcome.code);
      }
    } finally {
      this.values.update((value) => ({ ...value, password: '' }));
      this.busy.set(false);
    }
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.busy()) return false;
    return (
      !this.fields().dirty() ||
      this.confirmation.request(this.i18n.t('configurationWorkspace.unsaved'))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.busy() || this.fields().dirty()) event.preventDefault();
  }
}
