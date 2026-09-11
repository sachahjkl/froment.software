import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import type { PublicRuntimeConfigValue } from '@froment/contracts';

declare global {
  var fromentRuntimeConfig: PublicRuntimeConfigValue | undefined;
}

const developmentConfig: PublicRuntimeConfigValue = {
  appEnvironment: 'development',
  sitePhase: 'live',
};

const readBrowserConfig = (): PublicRuntimeConfigValue =>
  globalThis.fromentRuntimeConfig ?? developmentConfig;

@Injectable({ providedIn: 'root' })
export class RuntimeConfiguration {
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly value = this.browser ? readBrowserConfig() : undefined;
  readonly productionConstruction =
    this.value?.appEnvironment === 'production' && this.value.sitePhase === 'construction';
}
