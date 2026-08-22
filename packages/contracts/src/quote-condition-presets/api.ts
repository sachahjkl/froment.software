import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from 'effect/unstable/httpapi';

import { ApiRequestBody } from '../api-authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';
import { Permissions } from '../permissions.js';
import {
  QuoteConditionPreset,
  QuoteConditionPresetList,
  QuoteConditionPresetNameConflict,
  QuoteConditionPresetNotFound,
  QuoteConditionPresetWriteRequest,
} from './contracts.js';

export class QuoteConditionPresetsApi extends HttpApiGroup.make('quoteConditionPresets', {
  topLevel: true,
}).add(
  HttpApiEndpoint.get('quoteConditionPresetList', '/api/quote-condition-presets', {
    success: QuoteConditionPresetList,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
    ],
  }).pipe(requirePermissions([Permissions.quoteRead]), frontendSpecific),
  HttpApiEndpoint.post('quoteConditionPresetCreate', '/api/quote-condition-presets', {
    payload: QuoteConditionPresetWriteRequest,
    success: QuoteConditionPreset,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteConditionPresetNameConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.put('quoteConditionPresetUpdate', '/api/quote-condition-presets/:presetId', {
    params: { presetId: Ulid },
    payload: QuoteConditionPresetWriteRequest,
    success: QuoteConditionPreset,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteConditionPresetNotFound.pipe(HttpApiSchema.status(404)),
      QuoteConditionPresetNameConflict.pipe(HttpApiSchema.status(409)),
    ],
  })
    .middleware(ApiRequestBody)
    .pipe(
      requirePermissions([Permissions.quoteUpdate]),
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    ),
  HttpApiEndpoint.delete('quoteConditionPresetDelete', '/api/quote-condition-presets/:presetId', {
    params: { presetId: Ulid },
    success: QuoteConditionPreset,
    error: [
      AuthenticationRequired.pipe(HttpApiSchema.status(401)),
      PermissionDenied.pipe(HttpApiSchema.status(403)),
      CsrfRejected.pipe(HttpApiSchema.status(403)),
      RequestRateLimited.pipe(HttpApiSchema.status(429)),
      QuoteConditionPresetNotFound.pipe(HttpApiSchema.status(404)),
    ],
  }).pipe(
    requirePermissions([Permissions.quoteUpdate]),
    rateLimit(RateLimits.sixtyPerMinute),
    frontendSpecific,
  ),
) {}
