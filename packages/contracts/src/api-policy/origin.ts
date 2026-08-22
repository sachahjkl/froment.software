import { Schema } from 'effect';
import type * as HttpMethod from 'effect/unstable/http/HttpMethod';

import { ApiBrowserRequest } from '../api-authentication.js';
import type { Endpoint } from './endpoint.js';

export const requireBrowserOrigin = <
  Identifier extends string,
  Method extends HttpMethod.HttpMethod,
  Path extends string,
  Params extends Schema.Top,
  Query extends Schema.Top,
  Payload extends Schema.Top,
  Headers extends Schema.Top,
  Success extends Schema.Top,
  Error extends Schema.Top,
  Middleware,
  MiddlewareServices,
>(
  endpoint: Endpoint<
    Identifier,
    Method,
    Path,
    Params,
    Query,
    Payload,
    Headers,
    Success,
    Error,
    Middleware,
    MiddlewareServices
  >,
) => endpoint.middleware(ApiBrowserRequest);
