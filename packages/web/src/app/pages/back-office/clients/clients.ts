import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, pattern, required, submit } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  type ClientAccessValue,
  type ClientSummaryValue,
  type UlidValue,
} from '@froment/contracts';

import { ClientsApi, type ClientErrorCode } from '@backoffice/clients-api';
import { I18nService, TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { DataTable } from '@shared/data-table/data-table';
import { Badge } from '@shared/badge/badge';
import { Notice } from '@shared/notice/notice';
import { TextCopy } from '@shared/text-copy';

type PageState = 'loading' | 'ready' | 'error';
interface AccessResult extends ClientAccessValue {
  readonly displayName: string;
}

@Component({
  selector: 'app-clients',
  imports: [Badge, Button, DataTable, FormField, Notice, RouterLink],
  templateUrl: './clients.html',
  styleUrl: './clients.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly textCopy = inject(TextCopy);
  private readonly createModel = signal({
    displayName: '',
    addressLine1: '',
    addressLine2: '',
    postalCode: '',
    city: '',
    country: '',
    email: '',
  });
  protected readonly createForm = form(this.createModel, (path) => {
    required(path.displayName);
    maxLength(path.displayName, 120);
    pattern(path.displayName, /\S/);
    maxLength(path.addressLine1, 160);
    maxLength(path.addressLine2, 160);
    maxLength(path.postalCode, 32);
    maxLength(path.city, 120);
    maxLength(path.country, 120);
    maxLength(path.email, 254);
    pattern(path.email, /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
  protected readonly clients = signal<ReadonlyArray<ClientSummaryValue>>([]);
  protected readonly state = signal<PageState>('loading');
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly createPending = signal(false);
  protected readonly createDisabled = computed(
    () => this.createPending() || this.createForm().invalid(),
  );
  protected readonly displayNameInvalid = computed(
    () => this.createForm.displayName().touched() && this.createForm.displayName().invalid(),
  );
  protected readonly pendingClientId = signal<UlidValue | undefined>(undefined);
  protected readonly access = signal<AccessResult | undefined>(undefined);
  protected readonly copied = signal(false);
  private clientsRevision = 0;

  protected invalid(
    field: 'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'country' | 'email',
  ): boolean {
    return this.createForm[field]().touched() && this.createForm[field]().invalid();
  }

  constructor() {
    afterNextRender(() => void this.load());
  }

  protected create(event: SubmitEvent): void {
    event.preventDefault();
    void submit(this.createForm, async () => {
      this.createPending.set(true);
      this.error.set(undefined);
      const outcome = await this.api.create(this.createModel());
      this.createPending.set(false);
      if (!outcome.success) {
        this.setError(outcome.code);
        return;
      }
      this.clientsRevision++;
      this.clients.update((clients) =>
        [...clients, outcome.result].sort((left, right) =>
          left.displayName.localeCompare(right.displayName),
        ),
      );
      this.createModel.set({
        displayName: '',
        addressLine1: '',
        addressLine2: '',
        postalCode: '',
        city: '',
        country: '',
        email: '',
      });
      this.createForm().reset();
    });
  }

  protected async archive(client: ClientSummaryValue): Promise<void> {
    if (!window.confirm(this.i18n.t('backOffice.clients.archiveConfirmation'))) return;
    this.pendingClientId.set(client.id);
    this.error.set(undefined);
    const outcome = await this.api.archive(client.id);
    this.pendingClientId.set(undefined);
    if (!outcome.success) {
      this.setError(outcome.code);
      return;
    }
    this.clientsRevision++;
    this.clients.update((clients) =>
      clients.map((current) => {
        if (current.id === outcome.result.id) return outcome.result;
        return current;
      }),
    );
  }

  protected async createAccess(client: ClientSummaryValue): Promise<void> {
    this.pendingClientId.set(client.id);
    this.error.set(undefined);
    this.access.set(undefined);
    this.copied.set(false);
    const outcome = await this.api.createAccess(client.id);
    this.pendingClientId.set(undefined);
    if (!outcome.success) {
      this.setError(outcome.code);
      return;
    }
    this.access.set({ ...outcome.result, displayName: client.displayName });
  }

  protected async copyAccess(accessIdentifier: string): Promise<void> {
    if (await this.textCopy.copy(accessIdentifier)) {
      this.copied.set(true);
      return;
    }
    this.error.set('clipboard.error');
  }

  private async load(): Promise<void> {
    const revision = this.clientsRevision;
    try {
      const clients = await this.api.list();
      if (revision !== this.clientsRevision) {
        this.state.set('ready');
        return;
      }
      this.clients.set(clients);
      this.state.set('ready');
    } catch {
      this.state.set('error');
      this.error.set('client.error');
    }
  }

  private setError(code: ClientErrorCode): void {
    this.error.set(code);
  }
}
