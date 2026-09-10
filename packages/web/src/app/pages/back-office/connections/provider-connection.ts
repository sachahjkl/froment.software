import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { type CheckoutConnection, EmailTestAddress } from '@froment/contracts';
import { CheckoutApi } from '@backoffice/checkout-api';
import { Connections } from './connections';
import { workspaceTableQuery, workspaceTableParams } from '../configuration/workspace-table';
import { checkoutTableOptions, emailTableOptions } from '../configuration/workspace-tables';

@Component({
  host: { class: 'page-container' },
  imports: [Button, Notice, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-provider-connection',
  styleUrl: './provider-connection.scss',
  templateUrl: './provider-connection.html',
})
export class ProviderConnection extends Connections {
  protected readonly provider = inject(ActivatedRoute).snapshot.data['provider'];
  private readonly queryParams = toSignal(inject(ActivatedRoute).queryParamMap, {
    requireSync: true,
  });
  protected readonly testParams = computed(() =>
    this.provider === 'stripe'
      ? workspaceTableParams(
          workspaceTableQuery(this.queryParams(), checkoutTableOptions),
          checkoutTableOptions,
        )
      : workspaceTableParams(
          workspaceTableQuery(this.queryParams(), emailTableOptions),
          emailTableOptions,
        ),
  );
  protected readonly current = computed(() =>
    this.connections().find((item) => item.provider === this.provider),
  );
  protected readonly addresses = EmailTestAddress;
  protected readonly returnRequest = inject(ActivatedRoute).snapshot.queryParamMap.get('request');
  private readonly checkoutApi = inject(CheckoutApi);
  protected readonly stripeConnection = signal<typeof CheckoutConnection.Type | undefined>(
    undefined,
  );

  protected override async load(): Promise<void> {
    await super.load();
    if (this.provider !== 'stripe') return;
    this.loading.set(true);
    try {
      this.stripeConnection.set(await this.checkoutApi.connection());
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
