import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import {
  disabled,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Ulid, type ClientSummaryValue } from '@froment/contracts';
import { Option, Schema } from 'effect';

import { ClientsApi, type ClientErrorCode } from '@backoffice/clients-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';

const emptyClient = () => ({
  displayName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
});

@Component({
  selector: 'app-client-detail',
  imports: [Button, FormField, Notice, RouterLink],
  templateUrl: './client-detail.html',
  styleUrl: './client-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDetail {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly model = signal(emptyClient());
  private readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly clientForm = form(this.model, (path) => {
    required(path.displayName);
    pattern(path.displayName, /\S/);
    maxLength(path.displayName, 120);
    maxLength(path.addressLine1, 160);
    maxLength(path.addressLine2, 160);
    maxLength(path.postalCode, 32);
    maxLength(path.city, 120);
    maxLength(path.country, 120);
    maxLength(path.email, 254);
    pattern(path.email, /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    disabled(path, { when: () => this.archived() });
  });
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly archived = computed(() => this.client()?.archived ?? false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly saveDisabled = computed(
    () =>
      this.loading() ||
      this.saving() ||
      this.archived() ||
      this.clientForm().invalid() ||
      !this.clientForm().dirty(),
  );

  constructor() {
    afterNextRender(() => void this.load());
  }

  canDeactivate(): boolean {
    return (
      !this.clientForm().dirty() ||
      globalThis.confirm(this.i18n.t('backOffice.clientDetail.unsavedChanges'))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.clientForm().dirty()) event.preventDefault();
  }

  protected invalid(field: keyof ReturnType<typeof emptyClient>): boolean {
    return this.clientForm[field]().touched() && this.clientForm[field]().invalid();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    const current = this.client();
    if (current === undefined || current.archived) return;
    void submit(this.clientForm, async () => {
      this.saving.set(true);
      this.saved.set(false);
      this.error.set(undefined);
      const outcome = await this.api.update(current.id, {
        ...this.model(),
        expectedUpdatedAt: current.updatedAt,
      });
      this.saving.set(false);
      if (!outcome.success) {
        this.setError(outcome.code);
        return;
      }
      this.applyClient(outcome.result);
      this.saved.set(true);
    });
  }

  private async load(): Promise<void> {
    const clientId = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('clientId'));
    if (Option.isNone(clientId)) {
      this.error.set('client.not_found');
      this.loading.set(false);
      return;
    }
    const outcome = await this.api.get(clientId.value);
    if (!outcome.success) {
      this.setError(outcome.code);
      this.loading.set(false);
      return;
    }
    this.applyClient(outcome.result);
    this.loading.set(false);
  }

  private applyClient(client: ClientSummaryValue): void {
    this.client.set(client);
    this.model.set({
      displayName: client.displayName,
      addressLine1: client.addressLine1,
      addressLine2: client.addressLine2,
      postalCode: client.postalCode,
      city: client.city,
      country: client.country,
      email: client.email,
    });
    this.clientForm().reset();
  }

  private setError(code: ClientErrorCode): void {
    this.error.set(code);
  }
}
