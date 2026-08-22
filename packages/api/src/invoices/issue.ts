import { type InvoiceIssueRequestValue, type UlidValue } from '@froment/contracts';
import { Effect } from 'effect';

import { Invoices } from './invoices.js';
import { InvoicePdfJobs } from './pdf-jobs.js';

export const issueInvoice = Effect.fn('issueInvoice')(function* (
  invoiceId: UlidValue,
  payload: InvoiceIssueRequestValue,
  actorUserId: UlidValue,
) {
  const result = yield* (yield* Invoices)
    .issue(invoiceId, payload, actorUserId)
    .pipe(Effect.catchTag('DatabaseError', Effect.orDie));
  yield* (yield* InvoicePdfJobs)
    .runPending()
    .pipe(
      Effect.catch((error) => Effect.logError('Immediate invoice PDF rendering failed', error)),
    );
  return result;
});
