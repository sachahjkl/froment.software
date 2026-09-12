import { Api, ApiPrincipal } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setDownloadName, setPrivateResponseHeaders } from '../http/response.js';
import { Accounting } from './service.js';

const privateResult = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* setPrivateResponseHeaders;
    return yield* effect;
  });
export const AccountingHandlers = HttpApiBuilder.group(Api, 'accounting', (handlers) =>
  Effect.gen(function* () {
    const accounting = yield* Accounting;
    const actor = () => ApiPrincipal.use((principal) => Effect.succeed(principal.userId));
    return handlers
      .handle('accountingAccountList', () =>
        privateResult(accounting.accounts).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingAccountCreate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.writeAccount(undefined, payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingAccountUpdate', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.writeAccount(params.id, payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingJournalList', () =>
        privateResult(accounting.journals).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingJournalCreate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.writeJournal(undefined, payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingJournalUpdate', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.writeJournal(params.id, payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingPeriodList', () =>
        privateResult(accounting.periods).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingPeriodCreate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(accounting.createPeriod(payload, yield* actor())).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('accountingPeriodLock', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.transitionPeriod(
              params.id,
              payload.expectedVersion,
              'locked',
              yield* actor(),
            ),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingPeriodClose', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.transitionPeriod(
              params.id,
              payload.expectedVersion,
              'closed',
              yield* actor(),
            ),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingPeriodFinalClose', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.transitionPeriod(
              params.id,
              payload.expectedVersion,
              'final',
              yield* actor(),
            ),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingPeriodReopen', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.transitionPeriod(params.id, payload.expectedVersion, 'open', yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingEntryList', () =>
        privateResult(accounting.entries).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingEntryCreate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(accounting.createEntry(payload, yield* actor())).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('accountingEntryPost', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.postEntry(params.id, payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingEntryReverse', ({ params, payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.reverseEntry(params.id, payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingLetterableLineList', () =>
        privateResult(accounting.letterableLines).pipe(
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('accountingLetteringCreate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(accounting.createLettering(payload, yield* actor())).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('accountingBalanceReport', ({ query }) =>
        privateResult(accounting.balance(query)).pipe(
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('accountingLedgerReport', ({ query }) =>
        privateResult(accounting.ledger(query)).pipe(
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('accountingFinancialReport', ({ query }) =>
        privateResult(accounting.financial(query)).pipe(
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('accountingTaxReport', ({ query }) =>
        privateResult(accounting.tax(query)).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingCa3Export', ({ query }) =>
        accounting.ca3(query).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingFecExport', ({ query }) =>
        accounting.fec(query).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingTaxFilingSettings', () =>
        privateResult(accounting.taxFilingSettings).pipe(
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('accountingTaxFilingSettingsUpdate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(
            accounting.updateTaxFilingSettings(payload, yield* actor()),
          ).pipe(Effect.catchTag('DatabaseError', Effect.orDie));
        }),
      )
      .handle('accountingTaxFilingSubmissionList', () =>
        privateResult(accounting.taxFilings).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingTaxFilingSubmit', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(accounting.submitTaxFiling(payload, yield* actor())).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('accountingOpeningPreview', ({ payload }) =>
        privateResult(accounting.openingPreview(payload)).pipe(
          Effect.catchTag('DatabaseError', Effect.orDie),
        ),
      )
      .handle('accountingOpeningCommit', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(accounting.openingCommit(payload, yield* actor())).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('accountingEvidenceList', () =>
        privateResult(accounting.evidence).pipe(Effect.catchTag('DatabaseError', Effect.orDie)),
      )
      .handle('accountingEvidenceCreate', ({ payload }) =>
        Effect.gen(function* () {
          return yield* privateResult(accounting.createEvidence(payload, yield* actor())).pipe(
            Effect.catchTag('DatabaseError', Effect.orDie),
          );
        }),
      )
      .handle('accountingEvidenceDownload', ({ params }) =>
        Effect.gen(function* () {
          yield* setPrivateResponseHeaders;
          const result = yield* accounting
            .downloadEvidence(params.id, yield* actor())
            .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
          yield* setDownloadName(result.fileName, 'attachment');
          return result.content;
        }),
      );
  }),
);
