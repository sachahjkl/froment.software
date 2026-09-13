import { Can } from '@backoffice/can';
import { DemoApi } from '@backoffice/demo-api';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '@app/i18n.service';
import { RuntimeConfiguration } from '@app/runtime-configuration';
import { Button } from '@shared/button/button';
import { Confirmation } from '@shared/confirmation/confirmation';
import { Notice } from '@shared/notice/notice';

@Component({
  imports: [Button, Can, Notice, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-configuration-index',
  styleUrl: './configuration-index.scss',
  templateUrl: './configuration-index.html',
})
export class ConfigurationIndex {
  protected readonly i18n = inject(I18nService);
  private readonly api = inject(DemoApi);
  private readonly confirmation = inject(Confirmation);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfiguration);
  protected readonly demoAvailable = this.runtime.value?.appEnvironment === 'staging';
  protected readonly resetting = signal(false);
  protected readonly resetError = signal(false);

  protected async resetDemo(): Promise<void> {
    const password = await this.confirmation.requestSecret(
      this.i18n.t('demo.confirm'),
      this.i18n.t('demo.password'),
      { acceptLabel: this.i18n.t('demo.reset'), variant: 'danger' },
    );
    if (password === undefined) return;
    this.resetting.set(true);
    this.resetError.set(false);
    const result = await this.api.reset(password);
    this.resetting.set(false);
    if (!result.success) {
      this.resetError.set(true);
      return;
    }
    await this.router.navigate(['/backoffice/login'], { queryParams: { demoReset: 'true' } });
  }
}
