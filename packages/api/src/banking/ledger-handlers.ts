import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect, Layer } from 'effect';
import { HttpEffect, HttpServerResponse } from 'effect/unstable/http';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { BankLedger, BankLedgerLive } from './ledger.js';
import { ledgerCsv } from './ledger-export.js';

export const BankLedgerHandlers = HttpApiBuilder.group(Api, 'bankLedger', (handlers) =>
  Effect.gen(function* () {
    const ledger = yield* BankLedger;
    return handlers
      .handle(
        'bankLedgerList',
        Effect.fn('bankLedgerList')(function* ({ query }) {
          yield* setPrivateResponseHeaders;
          return yield* ledger.list(query).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankLedgerEntryGet',
        Effect.fn('bankLedgerEntryGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* ledger
            .getEntry(params.entryId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankLedgerSourceGet',
        Effect.fn('bankLedgerSourceGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* ledger
            .getSource(params.sourceKind, params.sourceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankLedgerPost',
        Effect.fn('bankLedgerPost')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* ledger
            .post(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankLedgerReverse',
        Effect.fn('bankLedgerReverse')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* ledger
            .reverse(params.entryId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankLedgerExport',
        Effect.fn('bankLedgerExport')(function* ({ query }) {
          yield* setPrivateResponseHeaders;
          yield* HttpEffect.appendPreResponseHandler((_request, response) =>
            Effect.succeed(
              HttpServerResponse.setHeader(
                response,
                'content-disposition',
                'attachment; filename="bank-ledger.csv"',
              ),
            ),
          );
          const records = yield* ledger
            .list(query)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          return ledgerCsv(records.entries);
        }),
      );
  }),
).pipe(Layer.provide(BankLedgerLive));
