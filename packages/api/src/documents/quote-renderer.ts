import { renderQuoteDefaultTemplate } from '@froment/documents';
import { type QuoteRenderSnapshotValue } from '@froment/contracts';
import { Context, Effect, Layer, Schema } from 'effect';

export class DocumentRenderError extends Schema.TaggedError<DocumentRenderError>()(
  'DocumentRenderError',
  { cause: Schema.Defect() },
) {}

export interface QuoteRendererService {
  readonly render: (
    snapshot: QuoteRenderSnapshotValue,
  ) => Effect.Effect<string, DocumentRenderError>;
}

export class QuoteRenderer extends Context.Service<QuoteRenderer, QuoteRendererService>()(
  '@froment/api/QuoteRenderer',
) {}

export const QuoteRendererLive = Layer.succeed(
  QuoteRenderer,
  QuoteRenderer.of({
    render: Effect.fn('QuoteRenderer.render')(function* (snapshot) {
      return yield* Effect.tryPromise({
        try: () => renderQuoteDefaultTemplate(snapshot),
        catch: (cause) => new DocumentRenderError({ cause }),
      });
    }),
  }),
);
