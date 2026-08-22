import type { Schema } from 'effect';
import type * as HttpMethod from 'effect/unstable/http/HttpMethod';
import type { HttpApiEndpoint } from 'effect/unstable/httpapi';

export type Endpoint<
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
> = HttpApiEndpoint.HttpApiEndpoint<
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
>;
