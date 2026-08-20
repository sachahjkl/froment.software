import {
  IssuerSettings as IssuerSettingsSchema,
  type IssuerSettingsUpdateRequestValue,
  type IssuerSettingsValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

export interface IssuerSettingsService {
  readonly get: Effect.Effect<IssuerSettingsValue, DatabaseError>;
  readonly update: (
    request: IssuerSettingsUpdateRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<IssuerSettingsValue, DatabaseError>;
}

export class IssuerSettings extends Context.Service<IssuerSettings, IssuerSettingsService>()(
  '@froment/api/IssuerSettings',
) {}

const selectSettings = `select display_name as displayName, address_line_1 as addressLine1,
  address_line_2 as addressLine2, postal_code as postalCode, city, country, email, phone,
  registration_number as registrationNumber, vat_number as vatNumber
  from issuer_settings where id = 1`;

export const IssuerSettingsLive = Layer.effect(
  IssuerSettings,
  Effect.gen(function* () {
    const database = yield* Database;
    const audit = yield* Audit;

    const get = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(IssuerSettingsSchema)(
          database.sqlite.prepare(selectSettings).get(),
        ),
      catch: (cause) => new DatabaseError({ operation: 'get issuer settings', cause }),
    });

    const update = Effect.fn('IssuerSettings.update')(function* (
      request: IssuerSettingsUpdateRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const settings = Object.fromEntries(
        Object.entries(request).map(([key, value]) => [key, value.trim()]),
      );
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              database.sqlite
                .prepare(
                  `update issuer_settings set display_name = ?, address_line_1 = ?, address_line_2 = ?,
                   postal_code = ?, city = ?, country = ?, email = ?, phone = ?,
                   registration_number = ?, vat_number = ?, updated_at = ? where id = 1`,
                )
                .run(
                  settings['displayName'],
                  settings['addressLine1'],
                  settings['addressLine2'],
                  settings['postalCode'],
                  settings['city'],
                  settings['country'],
                  settings['email'],
                  settings['phone'],
                  settings['registrationNumber'],
                  settings['vatNumber'],
                  now,
                );
              audit.insert({
                action: 'issuer.updated',
                actorUserId,
                resourceType: 'issuer-settings',
                resourceId: 'default',
                occurredAt: now,
              });
              return Schema.decodeUnknownSync(IssuerSettingsSchema)(
                database.sqlite.prepare(selectSettings).get(),
              );
            })
            .immediate(),
        catch: (cause) => new DatabaseError({ operation: 'update issuer settings', cause }),
      });
    });

    return IssuerSettings.of({ get, update });
  }),
);
