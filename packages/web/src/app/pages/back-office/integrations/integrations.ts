import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, disabled, form, required } from '@angular/forms/signals';
import { Confirmation } from '@shared/confirmation/confirmation';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import {
  IntegrationStatusList,
  IntegrationRetryList,
  type IntegrationOperationValue,
  type IntegrationSubmissionValue,
} from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { RouterLink } from '@angular/router';

type Kind = IntegrationSubmissionValue['kind'];
const labels = {
  email: 'integrations.email',
  signature: 'integrations.signature',
  payment: 'integrations.payment',
  banking: 'integrations.banking',
  'electronic-invoice': 'integrations.electronicInvoice',
} satisfies Record<Kind, TranslationKey>;

@Component({
  imports: [Button, Notice, LocalizedDatePipe, RouterLink, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-integrations',
  styleUrl: './integrations.scss',
  templateUrl: './integrations.html',
  host: { class: 'page-container', '(window:beforeunload)': 'beforeUnload($event)' },
})
export class Integrations {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(IntegrationsApi);
  private readonly confirmation = inject(Confirmation);
  protected readonly domainForm = form(signal({ kind: '' }), (path) => {
    required(path.kind);
    disabled(path, () => this.loading() || this.saving());
  });
  protected readonly labels = labels;
  protected readonly providers = signal<typeof IntegrationStatusList.Type>([]);
  protected readonly operations = signal<ReadonlyArray<IntegrationOperationValue>>([]);
  protected readonly retries = signal<typeof IntegrationRetryList.Type>([]);
  protected readonly retryLabels = {
    waiting: 'integrationRetry.waiting',
    processing: 'integrationRetry.processing',
    completed: 'integrationRetry.completed',
    exhausted: 'integrationRetry.exhausted',
    blocked: 'integrationRetry.blocked',
  } satisfies Record<(typeof IntegrationRetryList.Type)[number]['status'], TranslationKey>;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly completed = signal(false);
  private readonly result = viewChild('result', { read: ElementRef<HTMLElement> });
  private readonly pending = new Map<Kind, IntegrationSubmissionValue>();

  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const [providers, operations, retries] = await Promise.all([
        this.api.status(),
        this.api.list(),
        this.api.retries(),
      ]);
      this.providers.set(providers);
      this.operations.set(operations);
      this.retries.set(retries);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async simulate(kind: Kind): Promise<void> {
    if (
      this.saving() ||
      this.loading() ||
      !this.providers().some((provider) => provider.kind === kind && provider.mode === 'simulation')
    )
      return;
    const existing = this.pending.get(kind);
    if (existing !== undefined) {
      await this.send(existing);
      return;
    }
    const common = {
      requestId: crypto.randomUUID(),
      reference: 'SIMULATION',
      expectedMode: 'simulation' as const,
    };
    const artifactId = '00000000000000000000000000';
    const email = 'simulation@example.test';
    let request: IntegrationSubmissionValue;
    switch (kind) {
      case 'email':
        request = {
          ...common,
          kind,
          recipient: email,
          subject: 'Simulation',
          body: this.i18n.t('integrations.simulated'),
        };
        break;
      case 'signature':
        request = { ...common, kind, artifactId, signerEmail: email };
        break;
      case 'payment':
        request = { ...common, kind, amountCents: 100, currency: 'EUR', customerEmail: email };
        break;
      case 'banking':
        request = {
          ...common,
          kind,
          accountReference: 'SIMULATION',
          from: '2026-01-01',
          to: '2026-01-31',
        };
        break;
      case 'electronic-invoice':
        request = { ...common, kind, artifactId };
        break;
    }
    this.pending.set(kind, request);
    await this.send(request);
  }

  protected async send(request: IntegrationSubmissionValue): Promise<void> {
    if (this.saving() || request.expectedMode !== 'simulation') return;
    this.saving.set(true);
    this.error.set(false);
    this.completed.set(false);
    try {
      const outcome = await this.api.submit(request);
      if (!outcome.success) {
        this.error.set(true);
        return;
      }
      this.pending.delete(request.kind);
      this.operations.update((operations) =>
        [
          outcome.result,
          ...operations.filter((operation) => operation.id !== outcome.result.id),
        ].slice(0, 100),
      );
      this.completed.set(true);
      this.result()?.nativeElement.focus();
    } finally {
      this.saving.set(false);
    }
  }
  protected async run(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.saving() || this.loading()) return;
    if (this.domainForm().invalid()) {
      this.domainForm().markAsTouched();
      this.domainForm.kind().focusBoundControl();
      return;
    }
    const provider = this.providers().find((item) => item.kind === this.domainForm.kind().value());
    if (provider !== undefined) await this.simulate(provider.kind);
  }
  canDeactivate(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    return (
      this.pending.size === 0 ||
      this.confirmation.request(this.i18n.t('configurationWorkspace.unsaved'))
    );
  }
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.saving() || this.pending.size > 0) event.preventDefault();
  }
}
