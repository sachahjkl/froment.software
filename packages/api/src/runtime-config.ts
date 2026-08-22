import { Config, Context, Layer, Schema } from 'effect';

const PositiveInt = Schema.Int.check(Schema.isGreaterThan(0));

const positiveInt = (name: string, defaultValue: number) =>
  Config.schema(PositiveInt, name).pipe(Config.withDefault(defaultValue));

export const defaultAuthenticationRuntimeConfig = {
  accessTokenLifetimeMillis: 600_000,
  accessTokenClockToleranceMillis: 30_000,
  refreshSessionLifetimeMillis: 2_592_000_000,
  refreshRotationGraceMillis: 5_000,
  refreshAttemptsPerAddressPerMinute: 600,
  refreshAttemptsPerTokenPerMinute: 10,
  apiTokenAttemptsPerAddressPerMinute: 120,
  successfulLoginsPerMinute: 60,
  quotaWindowMillis: 60_000,
  failureBaseDelayMillis: 1_000,
  failureMaximumDelayMillis: 900_000,
  failureExponentLimit: 10,
  failureCacheCapacity: 10_000,
  failureCacheLifetimeMillis: 3_600_000,
  successfulLoginCacheCapacity: 20_000,
  successfulLoginCacheLifetimeMillis: 120_000,
  expiredSessionCleanupLimit: 500,
  bootstrapScryptMaximumMemoryBytes: 33_554_432,
  bootstrapConcurrency: 1,
} as const;

export const RuntimeConfig = {
  authentication: Config.all({
    accessTokenLifetimeMillis: positiveInt(
      'AUTH_ACCESS_TOKEN_LIFETIME_MILLIS',
      defaultAuthenticationRuntimeConfig.accessTokenLifetimeMillis,
    ),
    accessTokenClockToleranceMillis: positiveInt(
      'AUTH_ACCESS_TOKEN_CLOCK_TOLERANCE_MILLIS',
      defaultAuthenticationRuntimeConfig.accessTokenClockToleranceMillis,
    ),
    refreshSessionLifetimeMillis: positiveInt(
      'AUTH_REFRESH_SESSION_LIFETIME_MILLIS',
      defaultAuthenticationRuntimeConfig.refreshSessionLifetimeMillis,
    ),
    refreshRotationGraceMillis: positiveInt(
      'AUTH_REFRESH_ROTATION_GRACE_MILLIS',
      defaultAuthenticationRuntimeConfig.refreshRotationGraceMillis,
    ),
    refreshAttemptsPerAddressPerMinute: positiveInt(
      'AUTH_REFRESH_ADDRESS_LIMIT_PER_MINUTE',
      defaultAuthenticationRuntimeConfig.refreshAttemptsPerAddressPerMinute,
    ),
    refreshAttemptsPerTokenPerMinute: positiveInt(
      'AUTH_REFRESH_TOKEN_LIMIT_PER_MINUTE',
      defaultAuthenticationRuntimeConfig.refreshAttemptsPerTokenPerMinute,
    ),
    apiTokenAttemptsPerAddressPerMinute: positiveInt(
      'AUTH_API_TOKEN_ADDRESS_LIMIT_PER_MINUTE',
      defaultAuthenticationRuntimeConfig.apiTokenAttemptsPerAddressPerMinute,
    ),
    successfulLoginsPerMinute: positiveInt(
      'AUTH_SUCCESSFUL_LOGIN_LIMIT_PER_MINUTE',
      defaultAuthenticationRuntimeConfig.successfulLoginsPerMinute,
    ),
    quotaWindowMillis: positiveInt(
      'AUTH_QUOTA_WINDOW_MILLIS',
      defaultAuthenticationRuntimeConfig.quotaWindowMillis,
    ),
    failureBaseDelayMillis: positiveInt(
      'AUTH_FAILURE_BASE_DELAY_MILLIS',
      defaultAuthenticationRuntimeConfig.failureBaseDelayMillis,
    ),
    failureMaximumDelayMillis: positiveInt(
      'AUTH_FAILURE_MAXIMUM_DELAY_MILLIS',
      defaultAuthenticationRuntimeConfig.failureMaximumDelayMillis,
    ),
    failureExponentLimit: positiveInt(
      'AUTH_FAILURE_EXPONENT_LIMIT',
      defaultAuthenticationRuntimeConfig.failureExponentLimit,
    ),
    failureCacheCapacity: positiveInt(
      'AUTH_FAILURE_CACHE_CAPACITY',
      defaultAuthenticationRuntimeConfig.failureCacheCapacity,
    ),
    failureCacheLifetimeMillis: positiveInt(
      'AUTH_FAILURE_CACHE_LIFETIME_MILLIS',
      defaultAuthenticationRuntimeConfig.failureCacheLifetimeMillis,
    ),
    successfulLoginCacheCapacity: positiveInt(
      'AUTH_SUCCESSFUL_LOGIN_CACHE_CAPACITY',
      defaultAuthenticationRuntimeConfig.successfulLoginCacheCapacity,
    ),
    successfulLoginCacheLifetimeMillis: positiveInt(
      'AUTH_SUCCESSFUL_LOGIN_CACHE_LIFETIME_MILLIS',
      defaultAuthenticationRuntimeConfig.successfulLoginCacheLifetimeMillis,
    ),
    expiredSessionCleanupLimit: positiveInt(
      'AUTH_EXPIRED_SESSION_CLEANUP_LIMIT',
      defaultAuthenticationRuntimeConfig.expiredSessionCleanupLimit,
    ),
    bootstrapScryptMaximumMemoryBytes: positiveInt(
      'AUTH_BOOTSTRAP_SCRYPT_MAXIMUM_MEMORY_BYTES',
      defaultAuthenticationRuntimeConfig.bootstrapScryptMaximumMemoryBytes,
    ),
    bootstrapConcurrency: positiveInt(
      'AUTH_BOOTSTRAP_CONCURRENCY',
      defaultAuthenticationRuntimeConfig.bootstrapConcurrency,
    ),
  }),
  requestLimiter: Config.all({
    capacity: positiveInt('REQUEST_LIMITER_CAPACITY', 10_000),
    cacheLifetimeMillis: positiveInt('REQUEST_LIMITER_CACHE_LIFETIME_MILLIS', 120_000),
    windowMillis: positiveInt('REQUEST_LIMITER_WINDOW_MILLIS', 60_000),
  }),
  publicQuote: Config.all({
    readPerMinute: positiveInt('PUBLIC_QUOTE_READ_LIMIT_PER_MINUTE', 60),
    downloadPerMinute: positiveInt('PUBLIC_QUOTE_DOWNLOAD_LIMIT_PER_MINUTE', 20),
    signaturePerMinute: positiveInt('PUBLIC_QUOTE_SIGNATURE_LIMIT_PER_MINUTE', 10),
    linkLifetimeMillis: positiveInt('PUBLIC_QUOTE_LINK_LIFETIME_MILLIS', 2_592_000_000),
  }),
  apiToken: Config.all({
    maximumLifetimeMillis: positiveInt('API_TOKEN_MAXIMUM_LIFETIME_MILLIS', 31_536_000_000),
    defaultRateLimitPerMinute: positiveInt('API_TOKEN_DEFAULT_RATE_LIMIT_PER_MINUTE', 120),
    defaultPageSize: positiveInt('API_TOKEN_DEFAULT_PAGE_SIZE', 50),
    lastUsedUpdateIntervalMillis: positiveInt('API_TOKEN_LAST_USED_UPDATE_INTERVAL_MILLIS', 60_000),
  }),
  password: Config.all({
    memoryCost: positiveInt('ARGON2_MEMORY_COST', 19_456),
    timeCost: positiveInt('ARGON2_TIME_COST', 2),
    parallelism: positiveInt('ARGON2_PARALLELISM', 1),
    hashLength: positiveInt('ARGON2_HASH_LENGTH', 32),
  }),
  documentRenderer: Config.all({
    concurrency: positiveInt('DOCUMENT_RENDER_CONCURRENCY', 2),
    maximumOutputBytes: positiveInt('DOCUMENT_RENDER_MAXIMUM_OUTPUT_BYTES', 1_048_576),
  }),
  invoicePdfWorker: Config.all({
    concurrency: positiveInt('INVOICE_PDF_WORKER_CONCURRENCY', 1),
    intervalMillis: positiveInt('INVOICE_PDF_WORKER_INTERVAL_MILLIS', 1_000),
  }),
  database: Config.all({
    busyTimeoutMillis: positiveInt('DATABASE_BUSY_TIMEOUT_MILLIS', 5_000),
  }),
  http: Config.all({
    maximumRequestBodyBytes: positiveInt('HTTP_MAXIMUM_REQUEST_BODY_BYTES', 32_768),
  }),
} as const;

export const defaultRuntimeConfig = {
  authentication: defaultAuthenticationRuntimeConfig,
  requestLimiter: { capacity: 10_000, cacheLifetimeMillis: 120_000, windowMillis: 60_000 },
  publicQuote: {
    readPerMinute: 60,
    downloadPerMinute: 20,
    signaturePerMinute: 10,
    linkLifetimeMillis: 2_592_000_000,
  },
  apiToken: {
    maximumLifetimeMillis: 31_536_000_000,
    defaultRateLimitPerMinute: 120,
    defaultPageSize: 50,
    lastUsedUpdateIntervalMillis: 60_000,
  },
  password: { memoryCost: 19_456, timeCost: 2, parallelism: 1, hashLength: 32 },
  documentRenderer: { concurrency: 2, maximumOutputBytes: 1_048_576 },
  invoicePdfWorker: { concurrency: 1, intervalMillis: 1_000 },
  database: { busyTimeoutMillis: 5_000 },
  http: { maximumRequestBodyBytes: 32_768 },
} as const;

export const runtimeConfig = Config.all(RuntimeConfig);
export type RuntimeConfigValue = Config.Success<typeof runtimeConfig>;

export const RuntimeConfiguration = Context.Reference<RuntimeConfigValue>(
  '@froment/api/RuntimeConfiguration',
  { defaultValue: () => defaultRuntimeConfig },
);

export const RuntimeConfigurationLive = Layer.effect(RuntimeConfiguration, runtimeConfig);

export const RuntimeConfigurationDefaults = Layer.succeed(
  RuntimeConfiguration,
  defaultRuntimeConfig,
);
