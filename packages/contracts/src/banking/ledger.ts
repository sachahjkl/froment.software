import { Schema } from 'effect';
import { Ulid } from '../identifiers.js';
import { CalendarDate, IsoUtc } from '../temporal.js';
import { PositiveSafeInteger } from '../documents/lines.js';

export const LedgerSourceKind = Schema.Literals(['debit', 'fee']);
export const LedgerAccount = Schema.String.check(
  Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/),
);
export const LedgerRequest = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  sourceKind: LedgerSourceKind,
  sourceId: Ulid,
  debitAccount: LedgerAccount,
  creditAccount: LedgerAccount,
  label: Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160)),
}).check(
  Schema.makeFilter((entry) => entry.debitAccount !== entry.creditAccount, {
    message: 'ledger.accounts_identical',
  }),
);
export const LedgerEntry = Schema.Struct({
  ...LedgerRequest.fields,
  id: Ulid,
  amountCents: PositiveSafeInteger,
  bookedOn: CalendarDate,
  recordedAt: IsoUtc,
  recordedByUserId: Ulid,
  reversesId: Schema.NullOr(Ulid),
  reversalId: Schema.NullOr(Ulid),
});
export const LedgerSource = Schema.Struct({
  sourceId: Ulid,
  sourceKind: LedgerSourceKind,
  reference: Schema.String,
  account: Schema.String,
  bookedOn: CalendarDate,
  amountCents: PositiveSafeInteger,
  entryId: Schema.NullOr(Ulid),
});
export const LedgerList = Schema.Struct({
  entries: Schema.Array(LedgerEntry),
  sources: Schema.Array(LedgerSource),
});
export const LedgerReverse = Schema.Struct({
  requestId: LedgerRequest.fields.requestId,
  reason: LedgerRequest.fields.label,
  bookedOn: CalendarDate,
});
export const LedgerPeriod = Schema.Struct({ from: CalendarDate, to: CalendarDate }).check(
  Schema.makeFilter((period) => period.from <= period.to, { message: 'ledger.invalid_period' }),
);
export class LedgerConflict extends Schema.TaggedError<LedgerConflict>()(
  'LedgerConflict',
  { code: Schema.Literal('ledger.conflict') },
  { httpApiStatus: 409 },
) {}
