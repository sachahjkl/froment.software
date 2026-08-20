import { Config, Context, DateTime, Effect, Layer, Option, Schema } from 'effect';

const NamedTimeZone = Schema.String.check(
  Schema.makeFilter((value) => Option.isSome(DateTime.zoneMakeNamed(value)), {
    message: 'Expected an IANA time zone name.',
  }),
);

export interface BusinessConfigService {
  readonly timeZone: DateTime.TimeZone.Named;
}

export class BusinessConfig extends Context.Service<BusinessConfig, BusinessConfigService>()(
  '@froment/api/BusinessConfig',
) {}

export const BusinessConfigLive = Layer.effect(
  BusinessConfig,
  Effect.gen(function* () {
    const timeZoneName = yield* Config.schema(NamedTimeZone, 'BUSINESS_TIME_ZONE');
    return BusinessConfig.of({ timeZone: DateTime.zoneMakeNamedUnsafe(timeZoneName) });
  }),
);
