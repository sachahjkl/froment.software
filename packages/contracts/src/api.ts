import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { HealthStatus } from './status.js';
import {
  AuthenticationRejected,
  AuthenticationRateLimited,
  LoginRequest,
  PermissionDenied,
  AuthenticationRequired,
  CsrfRejected,
  SessionRejected,
  SessionStatus,
} from './authentication.js';
import {
  BootstrapRejected,
  BootstrapRateLimited,
  BootstrapRequest,
  BootstrapResult,
  BootstrapStatus,
  BootstrapUnavailable,
} from './bootstrap.js';
import {
  ClientAccess,
  ClientArchived,
  ClientCreateRequest,
  ClientList,
  ClientNotFound,
  ClientSummary,
} from './clients.js';
import { Ulid } from './identifiers.js';
import { DeploymentMetadata } from './version.js';

export class SystemApi extends HttpApiGroup.make('system', { topLevel: true }).add(
  HttpApiEndpoint.get('health', '/api/health', {
    success: HealthStatus,
  }),
  HttpApiEndpoint.get('version', '/api/version', {
    success: DeploymentMetadata,
  }),
  HttpApiEndpoint.get('bootstrapStatus', '/api/bootstrap', {
    success: BootstrapStatus,
  }),
  HttpApiEndpoint.post('bootstrapCreate', '/api/bootstrap', {
    payload: BootstrapRequest,
    success: BootstrapResult,
    error: [
      BootstrapRejected.pipe(HttpApiSchema.status(401)),
      BootstrapUnavailable.pipe(HttpApiSchema.status(409)),
      BootstrapRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.post('login', '/api/auth/login', {
    payload: LoginRequest,
    success: SessionStatus,
    error: [
      AuthenticationRejected.pipe(HttpApiSchema.status(401)),
      AuthenticationRateLimited.pipe(HttpApiSchema.status(429)),
    ],
  }),
  HttpApiEndpoint.get('sessionStatus', '/api/auth/session', {
    success: SessionStatus,
  }),
  HttpApiEndpoint.post('logout', '/api/auth/logout', {
    success: SessionStatus,
    error: SessionRejected.pipe(HttpApiSchema.status(401)),
  }),
) {}

export class ClientsApi extends HttpApiGroup.make('clients', { topLevel: true }).add(
  HttpApiEndpoint.get('clientList', '/api/clients', {
    success: ClientList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }),
  HttpApiEndpoint.post('clientCreate', '/api/clients', {
    payload: ClientCreateRequest,
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
    ],
  }),
  HttpApiEndpoint.post('clientArchive', '/api/clients/:clientId/archive', {
    params: { clientId: Ulid },
    success: ClientSummary,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }),
  HttpApiEndpoint.post('clientAccessCreate', '/api/clients/:clientId/access', {
    params: { clientId: Ulid },
    success: ClientAccess,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      ClientNotFound.pipe(HttpApiSchema.status(404)),
      ClientArchived.pipe(HttpApiSchema.status(409)),
    ],
  }),
) {}

export class Api extends HttpApi.make('froment-api').add(SystemApi).add(ClientsApi) {}
