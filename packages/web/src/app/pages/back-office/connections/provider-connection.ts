import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import {
  type CheckoutConnection,
  EmailTestAddress,
  ProviderConnection as ProviderConnectionSchema,
} from '@froment/contracts';
import { Schema } from 'effect';
import { I18nService } from '@app/i18n.service';
import { CheckoutApi } from '@backoffice/checkout-api';
import { ConnectionsData } from './connections-data';
import { providerTabs, providerTestParams } from './provider-navigation';
import { providerCredentialsLabel, providerModeLabel, providerName } from './connections-view';
import { PageHeader } from '@shared/page-header/page-header';
import { Tabs } from '@shared/tabs/tabs';
import { checkoutKeyLabel, checkoutWebhookLabel } from '../checkout/checkout-view';

@Component({
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink, PageHeader, Tabs],
  providers: [ConnectionsData],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-provider-connection',
  styleUrl: './provider-connection.scss',
  templateUrl: './provider-connection.html',
})
export class ProviderConnection {
  protected readonly i18n = inject(I18nService);
  protected readonly data = inject(ConnectionsData);
  protected readonly provider = Schema.decodeUnknownSync(ProviderConnectionSchema.fields.provider)(
    inject(ActivatedRoute).snapshot.data['provider'],
  );
  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap, {
    requireSync: true,
  });
  protected readonly testParams = computed(() =>
    providerTestParams(this.provider, this.queryParams()),
  );
  protected readonly tabs = computed(() => providerTabs(this.provider, this.i18n));
  protected readonly current = computed(() =>
    this.data.connections().find((item) => item.provider === this.provider),
  );
  protected readonly providerName = providerName;
  protected readonly credentialsLabel = providerCredentialsLabel;
  protected readonly modeLabel = providerModeLabel;
  protected readonly keyLabel = checkoutKeyLabel;
  protected readonly webhookLabel = checkoutWebhookLabel;
  protected readonly addresses = EmailTestAddress;
  protected readonly returnRequest = computed(() => this.queryParams().get('request'));
  private readonly checkoutApi = inject(CheckoutApi);
  protected readonly stripeConnection = signal<typeof CheckoutConnection.Type | undefined>(
    undefined,
  );
  private readonly stripeLoading = signal(false);
  private readonly stripeError = signal(false);
  protected readonly loading = computed(() => this.data.loading() || this.stripeLoading());
  protected readonly error = computed(() => this.data.error() || this.stripeError());

  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }

  protected async load(): Promise<void> {
    await Promise.all([this.data.load(), this.loadStripeConnection()]);
  }

  private async loadStripeConnection(): Promise<void> {
    if (this.provider !== 'stripe') return;
    this.stripeLoading.set(true);
    this.stripeError.set(false);
    try {
      this.stripeConnection.set(await this.checkoutApi.connection());
    } catch {
      this.stripeError.set(true);
    } finally {
      this.stripeLoading.set(false);
    }
  }
}
