import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { Schema } from 'effect';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { Permissions } from '../permissions.js';
import { IntegrationRetryList } from './retries.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  CheckoutConnection,
  CheckoutRequest,
  CheckoutOperation,
  CheckoutList,
  CheckoutFailure,
} from './checkout.js';
import {
  ProviderConnections,
  EmailTestRequest,
  EmailTestOperation,
  EmailTestList,
  EmailTestFailure,
} from './connections.js';
import {
  IntegrationFailure,
  IntegrationKind,
  IntegrationOperation,
  IntegrationOperationList,
  IntegrationStatusList,
  IntegrationSubmission,
} from './contracts.js';

export class IntegrationsApi extends HttpApiGroup.make('integrations', { topLevel: true }).add(
  HttpApiEndpoint.get('checkoutConnection', '/api/integrations/checkout/connection', {
    success: CheckoutConnection,
    error: CheckoutFailure.members,
  }).pipe(requirePermissions([Permissions.integrationConfigure]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('checkoutList', '/api/integrations/checkout', {
    success: CheckoutList,
    error: CheckoutFailure.members,
  }).pipe(
    requirePermissions([Permissions.integrationConfigure, Permissions.invoiceRead]),
    authenticate,
    frontendSpecific,
  ),
  HttpApiEndpoint.post('checkoutCreate', '/api/integrations/checkout', {
    payload: CheckoutRequest,
    success: CheckoutOperation,
    error: CheckoutFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.integrationConfigure, Permissions.invoiceRead]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.get('providerConnections', '/api/integrations/connections', {
    success: ProviderConnections,
    error: IntegrationFailure.members,
  }).pipe(requirePermissions([Permissions.integrationConfigure]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('emailTestList', '/api/integrations/email-tests', {
    success: EmailTestList,
    error: EmailTestFailure.members,
  }).pipe(requirePermissions([Permissions.integrationConfigure]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('emailTestCreate', '/api/integrations/email-tests', {
    payload: EmailTestRequest,
    success: EmailTestOperation,
    error: EmailTestFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.integrationConfigure]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.get('integrationRetryList', '/api/integrations/retries', {
    success: IntegrationRetryList,
    error: IntegrationFailure.members,
  }).pipe(requirePermissions([Permissions.integrationManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('integrationStatus', '/api/integrations', {
    success: IntegrationStatusList,
    error: IntegrationFailure.members,
  }).pipe(requirePermissions([Permissions.integrationManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.get('integrationOperationList', '/api/integrations/operations', {
    query: { kind: Schema.optional(IntegrationKind) },
    success: IntegrationOperationList,
    error: IntegrationFailure.members,
  }).pipe(requirePermissions([Permissions.integrationManage]), authenticate, frontendSpecific),
  HttpApiEndpoint.post('integrationOperationCreate', '/api/integrations/operations', {
    payload: IntegrationSubmission,
    success: IntegrationOperation,
    error: IntegrationFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.integrationManage]),
      authenticate,
      rateLimit(RateLimits.tenPerMinute),
      frontendSpecific,
    ),
) {}
