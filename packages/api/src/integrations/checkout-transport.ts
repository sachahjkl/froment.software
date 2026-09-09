import {
  CheckoutErrorCode,
  type CheckoutConnection,
  type CheckoutOperation,
} from '@froment/contracts';
import { Context, DateTime, type Effect, Schema } from 'effect';

export interface CheckoutSubmission {
  readonly requestId: string;
  readonly revisionId: string;
  readonly invoiceNumber: string;
  readonly amountCents: number;
  readonly expiresAt: number;
  readonly returnUrl: string;
}
export interface CheckoutSession {
  readonly id: string;
  readonly mode: 'test';
  readonly currency: 'EUR';
  readonly amountCents: number;
  readonly requestId: string;
  readonly revisionId: string;
  readonly status: 'open' | 'paid' | 'expired';
  readonly url: string | null;
  readonly expiresAt: number;
}
export class CheckoutTransportError extends Schema.TaggedError<CheckoutTransportError>()(
  'CheckoutTransportError',
  {
    code: CheckoutErrorCode,
    retryable: Schema.Boolean,
  },
) {}
export class CheckoutTransport extends Context.Service<
  CheckoutTransport,
  {
    readonly connection: typeof CheckoutConnection.Type;
    readonly accountKey: string | null;
    readonly publicOrigin: string;
    readonly create: (
      input: CheckoutSubmission,
    ) => Effect.Effect<CheckoutSession, CheckoutTransportError>;
    readonly retrieve: (
      sessionId: string,
    ) => Effect.Effect<CheckoutSession, CheckoutTransportError>;
  }
>()('@froment/api/CheckoutTransport') {}

export const matchesCheckout = (operation: CheckoutOperation, session: CheckoutSession) =>
  session.mode === operation.mode &&
  session.currency === operation.currency &&
  session.amountCents === operation.amountCents &&
  session.requestId === operation.request.requestId &&
  session.revisionId === operation.revisionId &&
  session.expiresAt === DateTime.toEpochMillis(DateTime.makeUnsafe(operation.expiresAt)) &&
  (operation.sessionId === null || operation.sessionId === session.id);
