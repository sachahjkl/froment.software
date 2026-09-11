import { Schema } from 'effect';

export const AppEnvironment = Schema.Literals(['development', 'staging', 'production']);
export type AppEnvironment = typeof AppEnvironment.Type;

export const SitePhase = Schema.Literals(['construction', 'live']);
export type SitePhase = typeof SitePhase.Type;

export const PublicRuntimeConfig = Schema.Struct({
  appEnvironment: AppEnvironment,
  sitePhase: SitePhase,
});
export type PublicRuntimeConfig = typeof PublicRuntimeConfig.Type;
