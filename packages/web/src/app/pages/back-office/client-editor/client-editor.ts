import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  disabled,
  FormField,
  form,
  maxLength,
  pattern,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Ulid,
  ClientInput,
  type ClientInputValue,
  type ClientCreateRequestValue,
  type ClientSummaryValue,
} from '@froment/contracts';
import { Option, Schema } from 'effect';
import { ClientsApi, type ClientOutcome } from '@backoffice/clients-api';
import { ClientCreationStore, type PendingClientCreation } from '@backoffice/client-creation-store';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { clientNavigationQuery } from '../client-detail/client-navigation';

const emptyClient = (): ClientInputValue => ({
  displayName: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  email: '',
});

@Component({
  host: { class: 'page-container' },
  selector: 'app-client-editor',
  imports: [Can, Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './client-editor.html',
  styleUrl: './client-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly creationStore = inject(ClientCreationStore);
  private store: PendingClientCreation | undefined;
  protected readonly pendingCreation = signal<ClientCreateRequestValue | undefined>(undefined);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(Confirmation);
  private readonly queryParams = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  protected readonly returnQuery = computed(() => clientNavigationQuery(this.queryParams()));
  protected readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly saving = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  private readonly model = signal(emptyClient());
  protected readonly editing = signal(false);
  protected readonly saveLabel = computed<TranslationKey>(() => {
    if (this.saving()) return 'backOffice.clientDetail.saving';
    if (this.pendingCreation()) return 'client.creation_retry';
    return this.editing() ? 'backOffice.clientDetail.save' : 'backOffice.clients.create';
  });
  protected readonly writePermission = computed<PermissionCodeValue>(() =>
    this.editing() ? 'client.update' : 'client.create',
  );
  protected readonly titleLabel = computed<TranslationKey>(() =>
    this.editing() ? 'clientsWorkspace.edit' : 'backOffice.clients.create',
  );
  protected readonly descriptionLabel = computed<TranslationKey>(() =>
    this.editing() ? 'clientsWorkspace.editIntro' : 'clientsWorkspace.formIntro',
  );
  protected readonly backLabel = computed<TranslationKey>(() =>
    this.client() ? 'clientsWorkspace.backToClient' : 'backOffice.backToClients',
  );
  protected readonly backLink = computed(() => {
    const client = this.client();
    if (client) return ['/backoffice/clients', client.id];
    return ['/backoffice/clients', this.returnQuery().view ?? 'active'];
  });
  protected readonly groups = [
    {
      title: 'clientsWorkspace.identity',
      fields: [
        { name: 'displayName', autocomplete: 'organization', type: 'text', wide: true },
        { name: 'email', autocomplete: 'email', type: 'email', wide: true },
      ],
    },
    {
      title: 'clientsWorkspace.address',
      fields: [
        { name: 'addressLine1', autocomplete: 'address-line1', type: 'text', wide: true },
        { name: 'addressLine2', autocomplete: 'address-line2', type: 'text', wide: true },
        { name: 'postalCode', autocomplete: 'postal-code', type: 'text', wide: false },
        { name: 'city', autocomplete: 'address-level2', type: 'text', wide: false },
        { name: 'country', autocomplete: 'country-name', type: 'text', wide: true },
      ],
    },
  ] as const;
  protected readonly clientForm = form(this.model, (path) => {
    disabled(
      path,
      () =>
        this.saving() ||
        this.pendingCreation() !== undefined ||
        this.completed() ||
        this.state() !== 'ready' ||
        this.client()?.archived === true,
    );
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
  });
  private loadGeneration = 0;

  constructor() {
    afterNextRender(() =>
      this.route.paramMap
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.load()),
    );
  }

  async canDeactivate(): Promise<boolean> {
    if (this.saving()) return false;
    if (this.completed()) return true;
    if (this.pendingCreation())
      return this.confirmation.request(this.i18n.t('client.creation_leave'));
    return (
      !this.clientForm().dirty() ||
      (await this.confirmation.request(this.i18n.t('backOffice.clientDetail.unsavedChanges')))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.pendingCreation() || this.clientForm().dirty())
      event.preventDefault();
  }

  protected invalid(field: keyof ClientInputValue): boolean {
    return this.clientForm[field]().touched() && this.clientForm[field]().invalid();
  }

  protected fieldError(field: keyof ClientInputValue): TranslationKey {
    if (field === 'displayName') return 'backOffice.clients.displayNameError';
    if (field === 'email') return 'backOffice.clientDetail.emailInvalid';
    return 'backOffice.clientDetail.fieldInvalid';
  }
  protected fieldLabel(field: keyof ClientInputValue): TranslationKey {
    return `backOffice.clients.${field}`;
  }

  protected async load(): Promise<void> {
    if (this.saving() || this.pendingCreation()) return;
    const generation = ++this.loadGeneration;
    const id = this.route.snapshot.paramMap.get('clientId');
    this.editing.set(id !== null);
    this.state.set('loading');
    this.completed.set(false);
    this.error.set(undefined);
    if (id === null) {
      try {
        const store = await this.creationStore.open();
        if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
        const pending = store.read();
        this.store = store;
        this.pendingCreation.set(pending);
        this.client.set(undefined);
        this.clientForm().reset(
          pending ? Schema.decodeUnknownSync(ClientInput)(pending) : emptyClient(),
        );
        this.state.set('ready');
      } catch {
        if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
        this.error.set('client.creation_storage_error');
        this.state.set('error');
      }
      return;
    }
    const decoded = Schema.decodeUnknownOption(Ulid)(id);
    if (Option.isNone(decoded)) {
      this.error.set('client.not_found');
      this.state.set('error');
      return;
    }
    const outcome = await this.api.get(decoded.value);
    if (generation !== this.loadGeneration || this.destroyRef.destroyed) return;
    if (!outcome.success) {
      this.error.set(outcome.code);
      this.state.set('error');
      return;
    }
    const { displayName, addressLine1, addressLine2, postalCode, city, country, email } =
      outcome.result;
    this.client.set(outcome.result);
    this.model.set({ displayName, addressLine1, addressLine2, postalCode, city, country, email });
    this.clientForm().reset();
    this.state.set('ready');
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    if (this.saving() || this.completed() || this.state() !== 'ready' || this.client()?.archived)
      return;
    if (this.pendingCreation()) {
      void this.retryCreation();
      return;
    }
    this.clientForm().markAsTouched();
    if (this.clientForm().invalid()) {
      this.clientForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.clientForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      try {
        const current = this.client();
        if (current) {
          await this.acceptOutcome(
            await this.api.update(current.id, {
              ...this.model(),
              expectedUpdatedAt: current.updatedAt,
            }),
          );
        } else {
          const request = { ...this.model(), requestId: crypto.randomUUID() };
          if (!this.store) {
            this.error.set('client.creation_storage_error');
            return;
          }
          try {
            this.store.write(request);
          } catch {
            this.error.set('client.creation_storage_error');
            return;
          }
          this.pendingCreation.set(request);
          await this.acceptOutcome(await this.api.create(request));
        }
      } catch {
        this.error.set('client.error');
      } finally {
        this.saving.set(false);
      }
    });
  }

  protected async retryCreation(): Promise<void> {
    const request = this.pendingCreation();
    if (!request || this.saving() || this.completed()) return;
    this.saving.set(true);
    this.error.set(undefined);
    try {
      await this.acceptOutcome(await this.api.create(request));
    } catch {
      this.error.set('client.error');
    } finally {
      this.saving.set(false);
    }
  }

  private async acceptOutcome(outcome: ClientOutcome<ClientSummaryValue>): Promise<void> {
    if (this.destroyRef.destroyed) return;
    if (!outcome.success) {
      this.error.set(outcome.code);
      return;
    }
    if (this.pendingCreation()) this.store?.clear();
    this.pendingCreation.set(undefined);
    this.client.set(outcome.result);
    this.completed.set(true);
    this.clientForm().reset();
    this.saving.set(false);
    await this.router.navigate(['/backoffice/clients', outcome.result.id], {
      queryParams: this.returnQuery(),
      queryParamsHandling: 'replace',
    });
  }
}
import { Can } from '@backoffice/can';
import type { PermissionCodeValue } from '@froment/contracts';
