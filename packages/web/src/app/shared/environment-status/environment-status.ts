import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { AppEnvironmentValue } from '@froment/contracts';

import { I18nService, type TranslationKey } from '../../i18n.service';
import { RuntimeConfiguration } from '../../runtime-configuration';

const environmentStatus = (
  environment: AppEnvironmentValue | undefined,
): { readonly labelKey: TranslationKey; readonly nameKey: TranslationKey } | undefined => {
  if (environment === 'development') {
    return {
      labelKey: 'shell.environment.development',
      nameKey: 'shell.environment.developmentName',
    };
  }
  if (environment === 'staging') {
    return {
      labelKey: 'shell.environment.staging',
      nameKey: 'shell.environment.stagingName',
    };
  }
  return undefined;
};

@Component({
  selector: 'app-environment-status',
  imports: [RouterLink],
  templateUrl: './environment-status.html',
  styleUrl: './environment-status.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvironmentStatus {
  readonly publicPage = input.required<boolean>();
  protected readonly i18n = inject(I18nService);
  private readonly runtime = inject(RuntimeConfiguration);
  protected readonly environment = this.runtime.value?.appEnvironment;
  protected readonly environmentStatus = environmentStatus(this.environment);
  protected readonly showConstruction = computed(
    () => this.publicPage() && this.runtime.productionConstruction,
  );
}
