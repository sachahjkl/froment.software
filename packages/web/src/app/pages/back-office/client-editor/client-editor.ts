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
import { Ulid, type ClientCreateRequestValue, type ClientSummaryValue } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { ClientsApi } from '@backoffice/clients-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';
import { clientNavigationQuery } from '../client-detail/client-navigation';

const emptyClient = (): ClientCreateRequestValue => ({
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
  imports: [Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './client-editor.html',
  styleUrl: './client-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
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
    return (
      !this.saving() &&
      (!this.clientForm().dirty() ||
        (await this.confirmation.request(this.i18n.t('backOffice.clientDetail.unsavedChanges'))))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.clientForm().dirty()) event.preventDefault();
  }

  protected invalid(field: keyof ClientCreateRequestValue): boolean {
    return this.clientForm[field]().touched() && this.clientForm[field]().invalid();
  }

  protected fieldError(field: keyof ClientCreateRequestValue): TranslationKey {
    if (field === 'displayName') return 'backOffice.clients.displayNameError';
    if (field === 'email') return 'backOffice.clientDetail.emailInvalid';
    return 'backOffice.clientDetail.fieldInvalid';
  }
  protected fieldLabel(field: keyof ClientCreateRequestValue): TranslationKey {
    return `backOffice.clients.${field}`;
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const id = this.route.snapshot.paramMap.get('clientId');
    this.editing.set(id !== null);
    this.state.set('loading');
    this.completed.set(false);
    this.error.set(undefined);
    if (id === null) {
      this.client.set(undefined);
      this.model.set(emptyClient());
      this.clientForm().reset();
      this.state.set('ready');
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
    this.clientForm().markAsTouched();
    if (this.clientForm().invalid()) {
      this.clientForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.clientForm, async () => {
      this.saving.set(true);
      this.error.set(undefined);
      const current = this.client();
      const outcome = current
        ? await this.api.update(current.id, {
            ...this.model(),
            expectedUpdatedAt: current.updatedAt,
          })
        : await this.api.create(this.model());
      this.saving.set(false);
      if (!outcome.success) {
        this.error.set(outcome.code);
        return;
      }
      this.client.set(outcome.result);
      this.completed.set(true);
      this.clientForm().reset();
      await this.router.navigate(['/backoffice/clients', outcome.result.id], {
        queryParams: this.returnQuery(),
        queryParamsHandling: 'replace',
      });
    });
  }
}
