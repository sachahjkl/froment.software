# API Endpoint Policies

## Principle

Each endpoint pipe controls one policy aspect. Roles never appear in endpoint policies.

Roles assign permissions to principals. Endpoints declare required permissions.

## Policy Aspects

| Aspect                  | Contract declaration                 | Runtime effect                                                    |
| ----------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| API visibility          | `frontendSpecific`                   | Adds the Frontend tag to the OpenAPI operation.                   |
| Authentication          | `authenticate`                       | Selects and validates the declared credential schemes.            |
| Permissions             | `requirePermissions([...])`          | Checks every permission and documents their stable codes.         |
| Rate limit              | `rateLimit(RateLimits.tenPerMinute)` | Limits requests for the endpoint and principal.                   |
| Request size            | `limitRequestBody`                   | Rejects an oversized payload with `RequestTooLarge`.              |
| Browser Origin          | `requireBrowserOrigin`               | Requires the configured Origin without authenticated credentials. |
| Resource scope          | Handler or domain service            | Limits records to the authenticated resource owner.               |
| Localized documentation | `operationId`                        | Resolves API prose from `@froment/l10n`.                          |

## Credential Rules

| Selected credential                                     | Origin       | CSRF         | Rate limit            |
| ------------------------------------------------------- | ------------ | ------------ | --------------------- |
| Session Cookie with `POST`, `PUT`, `PATCH`, or `DELETE` | Required     | Required     | Declared per endpoint |
| Session Cookie with another method                      | Not required | Not required | Declared per endpoint |
| API-token Bearer                                        | Not required | Not required | Declared per endpoint |

Mixed credentials are invalid. Missing or malformed credentials are invalid.

## Documented Endpoint

All endpoints appear in OpenAPI by default.

```ts
HttpApiEndpoint.get("quoteList", "/api/quotes", {
  success: QuoteList,
  error: quoteReadErrors,
}).pipe(requirePermissions([Permissions.quoteRead]), authenticate);
```

## Documented Mutation

```ts
HttpApiEndpoint.post("quoteSend", "/api/quotes/:quoteId/send", {
  params: { quoteId: Ulid },
  payload: QuoteSendRequest,
  success: QuoteSendResult,
  error: quoteSendErrors,
}).pipe(
  limitRequestBody,
  requirePermissions([Permissions.quoteSend]),
  authenticate,
  rateLimit(RateLimits.tenPerMinute),
);
```

## Frontend Endpoint

```ts
HttpApiEndpoint.post("apiTokenCreate", "/api/tokens", {
  payload: ApiTokenCreateRequest,
  success: ApiTokenCreated,
  error: apiTokenCreateErrors,
}).pipe(
  limitRequestBody,
  requirePermissions([Permissions.apiTokenManage]),
  authenticate,
  rateLimit(RateLimits.tenPerMinute),
  frontendSpecific,
);
```

`frontendSpecific` preserves the business tag and adds the `Frontend` tag.

## Localized OpenAPI

Effect generates paths, schemas, errors, security schemes, and operation identifiers.

`@froment/l10n` owns all API titles, summaries, descriptions, and security descriptions.

The OpenAPI transform performs these steps:

1. Select the French or English documentation object.
2. Match each operation through its stable `operationId`.
3. Add its localized summary and description.
4. Add the required permission codes from `x-required-permissions`.
5. Localize group and security-scheme descriptions.

The default routes use French. English uses `/api/docs/en` and `/api/openapi.en.json`.
