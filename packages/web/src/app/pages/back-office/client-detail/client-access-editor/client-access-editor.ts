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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  disabled,
  email,
  FormField,
  form,
  maxLength,
  minLength,
  required,
  submit,
} from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { accountPasswordConfig, Ulid, type ClientSummaryValue } from '@froment/contracts';
import { Option, Schema } from 'effect';
import { ClientsApi } from '@backoffice/clients-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';
import { PageHeader } from '@shared/page-header/page-header';

@Component({
  selector: 'app-client-access-editor',
  host: { class: 'page-container' },
  imports: [Button, FormField, Notice, PageHeader, RouterLink],
  templateUrl: './client-access-editor.html',
  styleUrl: './client-access-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientAccessEditor {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ClientsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmation = inject(Confirmation);
  protected readonly client = signal<ClientSummaryValue | undefined>(undefined);
  protected readonly loading = signal(true);
  protected readonly pending = signal(false);
  protected readonly completed = signal(false);
  protected readonly error = signal<TranslationKey | undefined>(undefined);
  protected readonly passwordConfig = accountPasswordConfig;
  private readonly model = signal({ email: '', password: '' });
  protected readonly passwordLength = computed(() => this.model().password.length);
  protected readonly backLink = computed(() =>
    this.client() ? ['/backoffice/clients', this.client()!.id, 'access'] : ['/backoffice/clients'],
  );
  protected readonly accessForm = form(this.model, (path) => {
    disabled(
      path,
      () =>
        this.loading() ||
        this.pending() ||
        this.completed() ||
        !this.client() ||
        this.client()?.archived === true,
    );
    required(path.email);
    email(path.email);
    maxLength(path.email, 254);
    required(path.password);
    minLength(path.password, accountPasswordConfig.minLength);
    maxLength(path.password, accountPasswordConfig.maxLength);
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
      !this.pending() &&
      (this.completed() ||
        !this.accessForm().dirty() ||
        (await this.confirmation.request(this.i18n.t('backOffice.clientDetail.unsavedChanges'))))
    );
  }

  @HostListener('window:beforeunload', ['$event'])
  protected preventUnsavedUnload(event: BeforeUnloadEvent): void {
    if (this.pending() || (!this.completed() && this.accessForm().dirty())) event.preventDefault();
  }

  protected invalid(field: 'email' | 'password'): boolean {
    return this.accessForm[field]().touched() && this.accessForm[field]().invalid();
  }

  protected async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set(undefined);
    this.client.set(undefined);
    this.completed.set(false);
    this.model.set({ email: '', password: '' });
    this.accessForm().reset();
    const id = Schema.decodeUnknownOption(Ulid)(this.route.snapshot.paramMap.get('clientId'));
    if (Option.isNone(id)) {
      this.error.set('client.not_found');
      this.loading.set(false);
      return;
    }
    try {
      const outcome = await this.api.get(id.value);
      if (this.destroyRef.destroyed || generation !== this.loadGeneration) return;
      if (outcome.success) this.client.set(outcome.result);
      else this.error.set(outcome.code);
    } catch {
      if (!this.destroyRef.destroyed && generation === this.loadGeneration)
        this.error.set('client.error');
    } finally {
      if (!this.destroyRef.destroyed && generation === this.loadGeneration) this.loading.set(false);
    }
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    const client = this.client();
    if (!client || client.archived || this.loading() || this.pending() || this.completed()) return;
    this.accessForm().markAsTouched();
    if (this.accessForm().invalid()) {
      this.accessForm().errorSummary()[0]?.fieldTree().focusBoundControl();
      return;
    }
    void submit(this.accessForm, async () => {
      this.pending.set(true);
      this.error.set(undefined);
      try {
        const outcome = await this.api.createAccess(client.id, this.model());
        if (this.destroyRef.destroyed) return;
        if (!outcome.success) {
          this.error.set(outcome.code);
          return;
        }
        this.completed.set(true);
        this.model.set({ email: '', password: '' });
        this.accessForm().reset();
      } catch {
        if (!this.destroyRef.destroyed) this.error.set('client.error');
      } finally {
        this.pending.set(false);
      }
      if (this.completed()) await this.router.navigate(this.backLink());
    });
  }
}
