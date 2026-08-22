import { Schema } from 'effect';
import type * as HttpMethod from 'effect/unstable/http/HttpMethod';
import { OpenApi } from 'effect/unstable/httpapi';

import type { Endpoint } from './endpoint.js';

export const frontendSpecific = <
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
) =>
  endpoint.annotateMerge(
    OpenApi.annotations({
      transform: (operation) => ({
        ...operation,
        tags: [...operation['tags'], 'frontend'],
      }),
    }),
  );
