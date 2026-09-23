import { NodeRuntime } from '@effect/platform-node';
import { Layer } from 'effect';
import { MarketingDependenciesLive, MarketingServerLive } from './marketing-server.js';

Layer.launch(MarketingServerLive.pipe(Layer.provide(MarketingDependenciesLive))).pipe(
  NodeRuntime.runMain,
);
