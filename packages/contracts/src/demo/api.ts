import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Permissions } from '../permissions.js';
import { ApiRequestBody } from '../api-authentication.js';
import { DemoFailure, DemoResetRequest, DemoResetResult } from './contracts.js';

export class DemoApi extends HttpApiGroup.make('demo', { topLevel: true }).add(
  HttpApiEndpoint.post('demoReset', '/api/demo/reset', {
    payload: DemoResetRequest,
    success: DemoResetResult,
    error: DemoFailure.members,
  })
    .middleware(ApiRequestBody)
    .pipe(requirePermissions([Permissions.demoReset]), authenticate, frontendSpecific),
) {}
