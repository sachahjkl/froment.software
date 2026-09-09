import { Context, Effect, Schema } from 'effect';
import { EmailTestErrorCode } from '@froment/contracts';

export const OutgoingEmail = Schema.Struct({
  requestId: Schema.String.check(Schema.isUUID(4)),
  from: Schema.String,
  replyTo: Schema.String,
  recipient: Schema.String,
  subject: Schema.String,
  body: Schema.String,
});
export type OutgoingEmail = typeof OutgoingEmail.Type;
export class EmailTransportError extends Schema.TaggedError<EmailTransportError>()(
  'EmailTransportError',
  {
    code: EmailTestErrorCode,
    retryable: Schema.Boolean,
  },
) {}
export class EmailTransport extends Context.Service<
  EmailTransport,
  {
    readonly accountKey: string | null;
    readonly send: (email: OutgoingEmail) => Effect.Effect<string, EmailTransportError>;
    readonly delivery: (
      providerId: string,
    ) => Effect.Effect<
      'accepted' | 'delivered' | 'bounced' | 'complained' | 'failed',
      EmailTransportError
    >;
  }
>()('@froment/api/EmailTransport') {}
