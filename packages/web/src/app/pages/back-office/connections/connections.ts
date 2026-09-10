import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProviderConnections } from '@froment/contracts';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { ConnectionsApi } from '@backoffice/connections-api';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { DataTable } from '@shared/data-table/data-table';

@Component({
  host: { class: 'page-container' },
  selector: 'app-connections',
  imports: [RouterLink, Button, Notice, DataTable],
  templateUrl: './connections.html',
  styleUrl: './connections.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Connections {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(ConnectionsApi);
  protected readonly connections = signal<typeof ProviderConnections.Type>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly names = {
    resend: 'connections.resend',
    stripe: 'connections.stripe',
    signwell: 'connections.signwell',
    superpdp: 'connections.superpdp',
  } satisfies Record<string, TranslationKey>;
  protected readonly usages = {
    resend: 'connections.email',
    stripe: 'connections.payment',
    signwell: 'connections.signature',
    superpdp: 'connections.electronicInvoice',
  } satisfies Record<string, TranslationKey>;
  constructor() {
    afterNextRender(() => {
      void this.load();
    });
  }
  protected async load(): Promise<void> {
    if (!this.loading()) this.loading.set(true);
    this.error.set(false);
    try {
      this.connections.set(await this.api.connections());
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
