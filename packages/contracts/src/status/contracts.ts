import { Schema } from 'effect';

export const HealthStatus = Schema.Struct({
  status: Schema.Literal('ok'),
});

export type HealthStatus = typeof HealthStatus.Type;
