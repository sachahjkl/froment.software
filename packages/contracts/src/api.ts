import { HttpApi, HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';

import { HealthStatus } from './status.js';

export class SystemApi extends HttpApiGroup.make('system', { topLevel: true }).add(
  HttpApiEndpoint.get('health', '/api/health', {
    success: HealthStatus,
  }),
) {}

export class Api extends HttpApi.make('froment-api').add(SystemApi) {}
