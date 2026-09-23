import { AppEnvironment, SitePhase } from '@froment/contracts';
import { Config, Context, Layer, Schema } from 'effect';

export const runtimeConfig = Config.all({
  application: Config.all({
    appEnvironment: Config.schema(AppEnvironment, 'APP_ENV').pipe(
      Config.withDefault('development' as const),
    ),
    sitePhase: Config.schema(SitePhase, 'SITE_PHASE').pipe(Config.withDefault('live' as const)),
    githubRepositoryUrl: Config.schema(Schema.String, 'GITHUB_REPOSITORY_URL').pipe(
      Config.withDefault('https://github.com/sachahjkl/froment.software'),
    ),
  }),
  marketing: Config.all({
    backofficeOrigin: Config.schema(Schema.URL, 'BACKOFFICE_ORIGIN').pipe(
      Config.withDefault(new URL('https://backoffice.froment.software')),
      Config.map((url) => url.origin),
    ),
  }),
});

export const RuntimeConfiguration = Context.Reference<Config.Success<typeof runtimeConfig>>(
  '@froment/marketing/RuntimeConfiguration',
  {
    defaultValue: () => ({
      application: {
        appEnvironment: 'development',
        sitePhase: 'live',
        githubRepositoryUrl: 'https://github.com/sachahjkl/froment.software',
      },
      marketing: { backofficeOrigin: 'https://backoffice.froment.software' },
    }),
  },
);

export const RuntimeConfigurationLive = Layer.effect(RuntimeConfiguration, runtimeConfig);
