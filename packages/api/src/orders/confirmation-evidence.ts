import { DocumentCalendar } from '@froment/contracts';
import { Schema } from 'effect';

export const CurrentOrderConfirmationEvidence = Schema.Struct({
  version: Schema.Literal(2),
  orderCalendar: DocumentCalendar,
});

export const OrderConfirmationEvidence = Schema.Union([
  Schema.Struct({ version: Schema.Literal(1) }),
  CurrentOrderConfirmationEvidence,
]);
