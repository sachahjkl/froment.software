import { afterNextRender, ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { type DeploymentMetadataValue } from '@froment/contracts';

import { I18nService } from '../../i18n.service';
import { VersionApi } from './version-api';

type VersionState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-version',
  templateUrl: './version.html',
  styleUrl: './version.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Version {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(VersionApi);
  protected readonly state = signal<VersionState>('loading');
  protected readonly metadata = signal<DeploymentMetadataValue | undefined>(undefined);

  constructor() {
    afterNextRender(() => void this.load());
  }

  private async load(): Promise<void> {
    try {
      this.metadata.set(await this.api.get());
      this.state.set('ready');
    } catch {
      this.state.set('error');
    }
  }
}
