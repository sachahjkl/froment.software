import {
  QuoteConditionPreset as QuoteConditionPresetSchema,
  QuoteConditionPresetNameConflict,
  QuoteConditionPresetNotFound,
  Ulid,
  type QuoteConditionPresetListValue,
  type QuoteConditionPresetValue,
  type QuoteConditionPresetWriteRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, Effect, Layer, Schema } from 'effect';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';

const PresetRecord = Schema.Struct({ id: Ulid, name: Schema.String, conditions: Schema.String });

type PresetWriteError =
  | QuoteConditionPresetNotFound
  | QuoteConditionPresetNameConflict
  | DatabaseError;

export interface QuoteConditionPresetsService {
  readonly list: Effect.Effect<QuoteConditionPresetListValue, DatabaseError>;
  readonly create: (
    request: QuoteConditionPresetWriteRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<QuoteConditionPresetValue, QuoteConditionPresetNameConflict | DatabaseError>;
  readonly update: (
    presetId: UlidValue,
    request: QuoteConditionPresetWriteRequestValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<QuoteConditionPresetValue, PresetWriteError>;
  readonly remove: (
    presetId: UlidValue,
    actorUserId: UlidValue,
  ) => Effect.Effect<QuoteConditionPresetValue, QuoteConditionPresetNotFound | DatabaseError>;
}

export class QuoteConditionPresets extends Context.Service<
  QuoteConditionPresets,
  QuoteConditionPresetsService
>()('@froment/api/QuoteConditionPresets') {}

export const QuoteConditionPresetsLive = Layer.effect(
  QuoteConditionPresets,
  Effect.gen(function* () {
    const database = yield* Database;
    const audit = yield* Audit;

    const read = (presetId: string): QuoteConditionPresetValue | undefined => {
      const row = database.sqlite
        .prepare('select id, name, conditions from quote_condition_presets where id = ?')
        .get(presetId);
      return row === undefined
        ? undefined
        : Schema.decodeUnknownSync(QuoteConditionPresetSchema)(
            Schema.decodeUnknownSync(PresetRecord)(row),
          );
    };

    const ensureNameAvailable = (name: string, ignoredId?: string) => {
      const existingId = database.sqlite
        .prepare(
          `select id from quote_condition_presets
           where name = ? and (? is null or id <> ?)`,
        )
        .pluck()
        .get(name, ignoredId ?? null, ignoredId ?? null);
      if (existingId !== undefined) {
        throw new QuoteConditionPresetNameConflict({
          code: 'quote_condition_preset.name_conflict',
        });
      }
    };

    const list = Effect.try({
      try: () =>
        Schema.decodeUnknownSync(Schema.Array(QuoteConditionPresetSchema))(
          database.sqlite
            .prepare(
              'select id, name, conditions from quote_condition_presets order by name collate nocase, id',
            )
            .all(),
        ),
      catch: (cause) => new DatabaseError({ operation: 'list.quote.condition.presets', cause }),
    });

    const create = Effect.fn('QuoteConditionPresets.create')(function* (
      request: QuoteConditionPresetWriteRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const presetId = ulid(now);
      const name = request.name.trim();
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              ensureNameAvailable(name);
              database.sqlite
                .prepare(
                  `insert into quote_condition_presets
                   (id, name, conditions, created_at, updated_at) values (?, ?, ?, ?, ?)`,
                )
                .run(presetId, name, request.conditions, now, now);
              audit.insert({
                action: 'quote.condition-preset-created',
                actorUserId,
                resourceType: 'quote-condition-preset',
                resourceId: presetId,
                metadata: { name },
                occurredAt: now,
              });
              const preset = read(presetId);
              if (preset === undefined) throw new Error('quote_condition_preset.created.missing');
              return preset;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof QuoteConditionPresetNameConflict
            ? cause
            : new DatabaseError({ operation: 'create.quote.condition.preset', cause }),
      });
    });

    const update = Effect.fn('QuoteConditionPresets.update')(function* (
      presetId: UlidValue,
      request: QuoteConditionPresetWriteRequestValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const name = request.name.trim();
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              if (read(presetId) === undefined) {
                throw new QuoteConditionPresetNotFound({
                  code: 'quote_condition_preset.not_found',
                });
              }
              ensureNameAvailable(name, presetId);
              database.sqlite
                .prepare(
                  `update quote_condition_presets set name = ?, conditions = ?, updated_at = ?
                   where id = ?`,
                )
                .run(name, request.conditions, now, presetId);
              audit.insert({
                action: 'quote.condition-preset-updated',
                actorUserId,
                resourceType: 'quote-condition-preset',
                resourceId: presetId,
                metadata: { name },
                occurredAt: now,
              });
              const preset = read(presetId);
              if (preset === undefined) throw new Error('quote_condition_preset.updated.missing');
              return preset;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof QuoteConditionPresetNotFound ||
          cause instanceof QuoteConditionPresetNameConflict
            ? cause
            : new DatabaseError({ operation: 'update.quote.condition.preset', cause }),
      });
    });

    const remove = Effect.fn('QuoteConditionPresets.remove')(function* (
      presetId: UlidValue,
      actorUserId: UlidValue,
    ) {
      const now = yield* Clock.currentTimeMillis;
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const preset = read(presetId);
              if (preset === undefined) {
                throw new QuoteConditionPresetNotFound({
                  code: 'quote_condition_preset.not_found',
                });
              }
              database.sqlite
                .prepare('delete from quote_condition_presets where id = ?')
                .run(presetId);
              audit.insert({
                action: 'quote.condition-preset-deleted',
                actorUserId,
                resourceType: 'quote-condition-preset',
                resourceId: presetId,
                metadata: { name: preset.name },
                occurredAt: now,
              });
              return preset;
            })
            .immediate(),
        catch: (cause) =>
          cause instanceof QuoteConditionPresetNotFound
            ? cause
            : new DatabaseError({ operation: 'delete.quote.condition.preset', cause }),
      });
    });

    return QuoteConditionPresets.of({ list, create, update, remove });
  }),
);
