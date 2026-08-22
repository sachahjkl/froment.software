import { Clock, Context, Effect, Layer, Schedule, Schema } from 'effect';

import { Database, DatabaseError } from '../database/database.js';
import { DocumentArtifacts } from '../documents/document-artifacts.js';

const JobRecord = Schema.Struct({
  invoiceRevisionId: Schema.String,
  invoiceId: Schema.String,
  version: Schema.Int,
  actorUserId: Schema.String,
});

export interface InvoicePdfJobsService {
  readonly runPending: () => Effect.Effect<void, DatabaseError>;
  readonly recoverInterrupted: Effect.Effect<void, DatabaseError>;
}

export class InvoicePdfJobs extends Context.Service<InvoicePdfJobs, InvoicePdfJobsService>()(
  '@froment/api/InvoicePdfJobs',
) {}

export const InvoicePdfJobsLive = Layer.effect(
  InvoicePdfJobs,
  Effect.gen(function* () {
    const database = yield* Database;
    const artifacts = yield* DocumentArtifacts;

    const recoverInterrupted = Effect.try({
      try: () => {
        database.sqlite
          .prepare(
            `update invoice_pdf_jobs
             set status = 'failed', error = 'pdf.render_failed'
             where status = 'processing'`,
          )
          .run();
      },
      catch: (cause) => new DatabaseError({ operation: 'recover invoice PDF jobs', cause }),
    });

    const processJob = Effect.fn('InvoicePdfJobs.processJob')(function* (
      invoiceRevisionId: string,
    ) {
      const now = yield* Clock.currentTimeMillis;
      const job = yield* Effect.try({
        try: () =>
          database.sqlite.transaction(() => {
            const claimed = database.sqlite
              .prepare(
                `update invoice_pdf_jobs
                 set status = 'processing', attempts = attempts + 1, error = null, updated_at = ?
                 where invoice_revision_id = ? and status in ('pending', 'failed')`,
              )
              .run(now, invoiceRevisionId).changes;
            if (claimed === 0) return undefined;
            return Schema.decodeUnknownSync(JobRecord)(
              database.sqlite
                .prepare(
                  `select invoice_revision_id as invoiceRevisionId, invoice_id as invoiceId,
                          version, actor_user_id as actorUserId
                   from invoice_pdf_jobs where invoice_revision_id = ?`,
                )
                .get(invoiceRevisionId),
            );
          })(),
        catch: (cause) => new DatabaseError({ operation: 'claim invoice PDF job', cause }),
      });
      if (job === undefined) return;

      const rendered = yield* artifacts
        .renderInvoicePdf(job.invoiceId, job.version, job.actorUserId)
        .pipe(
          Effect.as(true),
          Effect.catch(() => Effect.succeed(false)),
        );
      const completedAt = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () => {
          database.sqlite
            .prepare(
              `update invoice_pdf_jobs set status = ?, error = ?, updated_at = ?
               where invoice_revision_id = ? and status = 'processing'`,
            )
            .run(
              rendered ? 'ready' : 'failed',
              rendered ? null : 'pdf.render_failed',
              completedAt,
              invoiceRevisionId,
            );
        },
        catch: (cause) => new DatabaseError({ operation: 'complete invoice PDF job', cause }),
      });
    });

    const runPending = Effect.fn('InvoicePdfJobs.runPending')(function* () {
      const ids = yield* Effect.try({
        try: () =>
          Schema.decodeUnknownSync(Schema.Array(Schema.String))(
            database.sqlite
              .prepare(
                `select invoice_revision_id from invoice_pdf_jobs
                 where status in ('pending', 'failed') order by created_at, invoice_revision_id`,
              )
              .pluck()
              .all(),
          ),
        catch: (cause) => new DatabaseError({ operation: 'list invoice PDF jobs', cause }),
      });
      yield* Effect.forEach(ids, processJob, { concurrency: 1, discard: true });
    });

    return InvoicePdfJobs.of({ runPending, recoverInterrupted });
  }),
);

export const InvoicePdfWorkerLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const jobs = yield* InvoicePdfJobs;
    yield* jobs.recoverInterrupted;
    yield* jobs.runPending().pipe(
      Effect.catch((error) => Effect.logError('Invoice PDF worker cycle failed', error)),
      Effect.repeat(Schedule.spaced('1 second')),
      Effect.forkScoped,
    );
  }),
);
