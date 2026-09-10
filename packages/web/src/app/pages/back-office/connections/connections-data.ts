import { inject, Injectable, signal } from '@angular/core';
import { type ProviderConnections } from '@froment/contracts';
import { ConnectionsApi } from '@backoffice/connections-api';

@Injectable()
export class ConnectionsData {
  private readonly api = inject(ConnectionsApi);
  readonly connections = signal<typeof ProviderConnections.Type>([]);
  readonly loading = signal(true);
  readonly error = signal(false);

  async load(): Promise<void> {
    this.loading.set(true);
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
