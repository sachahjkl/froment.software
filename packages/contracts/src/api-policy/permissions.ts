import { Context, Schema } from 'effect';
import type * as HttpMethod from 'effect/unstable/http/HttpMethod';
import { OpenApi } from 'effect/unstable/httpapi';

import { ApiAuthentication, ApiAuthorization } from '../api-authentication.js';
import type { Permission, PermissionCode } from '../permissions.js';
import type { Endpoint } from './endpoint.js';

type RequiredPermissionList = readonly [Permission, ...ReadonlyArray<Permission>];

export class RequiredPermissions extends Context.Service<
  RequiredPermissions,
  readonly [PermissionCode, ...ReadonlyArray<PermissionCode>]
>()('@froment/contracts/RequiredPermissions') {}

export const requirePermissions = (permissions: RequiredPermissionList) => {
  const [first, ...rest] = permissions;
  const codes: readonly [PermissionCode, ...ReadonlyArray<PermissionCode>] = [
    first.code,
    ...rest.map(({ code }) => code),
  ];

  return <
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
    endpoint
      .annotate(RequiredPermissions, codes)
      .middleware(ApiAuthorization)
      .middleware(ApiAuthentication)
      .annotateMerge(
        OpenApi.annotations({
          override: { 'x-required-permissions': codes },
        }),
      );
};
