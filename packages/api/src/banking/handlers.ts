import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import { Banking } from './service.js';

export const BankingHandlers = HttpApiBuilder.group(Api, 'banking', (handlers) =>
  Effect.succeed(
    handlers
      .handle(
        'bankPaymentList',
        Effect.fn('bankPaymentList')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .payments(params.invoiceId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankMatchHistory',
        Effect.fn('bankMatchHistory')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .history(params.transactionId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankTransactionGet',
        Effect.fn('bankTransactionGet')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .get(params.transactionId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankTransactionList',
        Effect.fn('bankTransactionList')(function* () {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking).list.pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'supplierBankPaymentList',
        Effect.fn('supplierBankPaymentList')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .supplierPayments(params.transactionId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'supplierBankMatchList',
        Effect.fn('supplierBankMatchList')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .supplierMatches(params.transactionId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankMatchSuggestionList',
        Effect.fn('bankMatchSuggestionList')(function* ({ params }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .suggestions(params.transactionId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankImportPreview',
        Effect.fn('bankImportPreview')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .previewStatement(payload)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankImport',
        Effect.fn('bankImport')(function* ({ payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .importStatement(payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankMatch',
        Effect.fn('bankMatch')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .match(params.transactionId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'bankUnmatch',
        Effect.fn('bankUnmatch')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .unmatch(
              params.transactionId,
              payload.matchId,
              payload.reason,
              (yield* ApiPrincipal).userId,
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'supplierBankMatch',
        Effect.fn('supplierBankMatch')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .matchSupplier(params.transactionId, payload, (yield* ApiPrincipal).userId)
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle(
        'supplierBankUnmatch',
        Effect.fn('supplierBankUnmatch')(function* ({ params, payload }) {
          yield* setPrivateResponseHeaders;
          return yield* (yield* Banking)
            .unmatchSupplier(
              params.transactionId,
              payload.matchId,
              payload.reason,
              (yield* ApiPrincipal).userId,
            )
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      ),
  ),
);
