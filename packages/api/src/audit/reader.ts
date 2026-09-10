import {
  GlobalAuditEvent,
  GlobalAuditPage,
  GlobalAuditQuery,
  InvalidAuditQuery,
} from '@froment/contracts';
import { Context, DateTime, Effect, Layer, Schema } from 'effect';

import { Database, DatabaseError } from '../database/database.js';
import { RuntimeConfiguration } from '../runtime-config.js';
import { auditQuerySchema } from './query.js';

const AuditRow = Schema.Struct({
  ...GlobalAuditEvent.fields,
  occurredAt: Schema.Int,
});

export interface AuditReaderService {
  readonly list: (
    query: GlobalAuditQuery,
  ) => Effect.Effect<GlobalAuditPage, DatabaseError | InvalidAuditQuery>;
}

export class AuditReader extends Context.Service<AuditReader, AuditReaderService>()(
  '@froment/api/AuditReader',
) {}

export const AuditReaderLive = Layer.effect(
  AuditReader,
  Effect.gen(function* () {
    const database = yield* Database;
    const { pageSize } = (yield* RuntimeConfiguration).audit;
    const decodeQuery = Schema.decodeUnknownEffect(auditQuerySchema(pageSize));
    const decodeRows = Schema.decodeUnknownSync(
      Schema.Array(AuditRow).check(Schema.isMaxLength(pageSize)),
    );
    const list = Effect.fn('AuditReader.list')(function* (input: GlobalAuditQuery) {
      const query = yield* decodeQuery(input).pipe(
        Effect.mapError(() => new InvalidAuditQuery({ code: 'audit.invalid_query' })),
      );
      return yield* Effect.try({
        try: () =>
          database.sqlite
            .transaction(() => {
              const filters = ['1 = 1'];
              const values: string[] = [];
              if (query.action !== undefined) {
                filters.push('action = ?');
                values.push(query.action);
              }
              if (query.resourceType !== undefined) {
                filters.push('resource_type = ?');
                values.push(query.resourceType);
              }
              const where = filters.join(' and ');
              const newer = query.direction === 'newer';
              const pageFilters =
                query.cursor === undefined ? filters : [...filters, newer ? 'id > ?' : 'id < ?'];
              const bindings = query.cursor === undefined ? values : [...values, query.cursor];
              const rows = decodeRows(
                database.sqlite
                  .prepare(
                    `select id, action, actor_user_id as actorUserId,
                      resource_type as resourceType, resource_id as resourceId,
                      occurred_at as occurredAt
               from audit_events where ${pageFilters.join(' and ')}
               order by id ${newer ? 'asc' : 'desc'} limit ?`,
                  )
                  .all(...bindings, query.limit ?? pageSize),
              );
              const ordered = newer ? rows.toReversed() : rows;
              const first = ordered[0]?.id ?? query.cursor;
              const last = ordered.at(-1)?.id ?? query.cursor;
              const hasNewer =
                first !== undefined &&
                database.sqlite
                  .prepare(`select 1 from audit_events where ${where} and id > ? limit 1`)
                  .get(...values, first) !== undefined;
              const hasOlder =
                last !== undefined &&
                database.sqlite
                  .prepare(`select 1 from audit_events where ${where} and id < ? limit 1`)
                  .get(...values, last) !== undefined;
              return Schema.decodeUnknownSync(GlobalAuditPage)({
                items: ordered.map((row) => ({
                  ...row,
                  occurredAt: DateTime.formatIso(DateTime.makeUnsafe(row.occurredAt)),
                })),
                previousCursor: hasNewer ? first : null,
                nextCursor: hasOlder ? last : null,
              });
            })
            .deferred(),
        catch: (cause) => new DatabaseError({ operation: 'read.audit.events', cause }),
      });
    });
    return AuditReader.of({ list });
  }),
);
