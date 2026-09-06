import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';
import { ApiAuthentication, ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { Ulid } from '../identifiers.js';
import { BrowserSession } from './contracts.js';
import {
  PasskeyFailure,
  PasskeyList,
  PasskeyLoginOptions,
  PasskeyLoginResponse,
  PasskeyRegistrationOptions,
  PasskeyRegistrationRequest,
  PasskeyRegistrationResponse,
  PasskeyRemovalRequest,
} from './passkeys.js';

export class PasskeysApi extends HttpApiGroup.make('passkeys', { topLevel: true }).add(
  HttpApiEndpoint.get('passkeyList', '/api/auth/passkeys', {
    success: PasskeyList,
    error: PasskeyFailure.members,
  })
    .middleware(ApiAuthentication)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('passkeyRegisterOptions', '/api/auth/passkeys/register/options', {
    payload: PasskeyRegistrationRequest,
    success: PasskeyRegistrationOptions,
    error: PasskeyFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .middleware(ApiAuthentication)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('passkeyRegisterVerify', '/api/auth/passkeys/register/verify', {
    payload: PasskeyRegistrationResponse,
    success: HttpApiSchema.NoContent,
    error: PasskeyFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .middleware(ApiAuthentication)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('passkeyRemove', '/api/auth/passkeys/:passkeyId/remove', {
    params: { passkeyId: Ulid },
    payload: PasskeyRemovalRequest,
    success: HttpApiSchema.NoContent,
    error: PasskeyFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .middleware(ApiAuthentication)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('passkeyLoginOptions', '/api/auth/passkeys/login/options', {
    success: PasskeyLoginOptions,
    error: PasskeyFailure.members,
  })
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
  HttpApiEndpoint.post('passkeyLoginVerify', '/api/auth/passkeys/login/verify', {
    payload: PasskeyLoginResponse,
    success: BrowserSession,
    error: PasskeyFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(frontendSpecific),
) {}
