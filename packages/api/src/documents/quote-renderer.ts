import { renderQuoteDefaultTemplate } from '@froment/documents';
import { type QuoteRenderSnapshotValue } from '@froment/contracts';
import { Config, Context, Effect, Layer, Schema, TxSemaphore } from 'effect';
import { chromium } from 'playwright-core';

export class DocumentRenderError extends Schema.TaggedError<DocumentRenderError>()(
  'DocumentRenderError',
  { cause: Schema.Defect() },
) {}

export interface QuoteRendererService {
  readonly render: (
    snapshot: QuoteRenderSnapshotValue,
  ) => Effect.Effect<string, DocumentRenderError>;
  readonly renderPdf: (
    snapshot: QuoteRenderSnapshotValue,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
}

export class QuoteRenderer extends Context.Service<QuoteRenderer, QuoteRendererService>()(
  '@froment/api/QuoteRenderer',
) {}

export const QuoteRendererLive = Layer.effect(
  QuoteRenderer,
  Effect.gen(function* () {
    const executablePath = yield* Config.string('CHROMIUM_PATH');
    const browser = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () =>
          chromium.launch({
            executablePath,
            headless: true,
            args: ['--disable-dev-shm-usage', '--no-sandbox'],
          }),
        catch: (cause) => new DocumentRenderError({ cause }),
      }),
      (activeBrowser) => Effect.promise(() => activeBrowser.close()),
    );
    const permits = yield* TxSemaphore.make(2);

    const render = Effect.fn('QuoteRenderer.render')(function* (snapshot) {
      return yield* Effect.tryPromise({
        try: () => renderQuoteDefaultTemplate(snapshot),
        catch: (cause) => new DocumentRenderError({ cause }),
      });
    });

    const renderPdf = Effect.fn('QuoteRenderer.renderPdf')(function* (snapshot) {
      const html = yield* render(snapshot);
      return yield* TxSemaphore.withPermit(
        permits,
        Effect.tryPromise({
          try: async () => {
            const page = await browser.newPage();
            try {
              await page.setContent(html, { waitUntil: 'load' });
              return await page.pdf({
                format: 'A4',
                printBackground: true,
                preferCSSPageSize: true,
              });
            } finally {
              await page.close();
            }
          },
          catch: (cause) => new DocumentRenderError({ cause }),
        }),
      );
    });

    return QuoteRenderer.of({ render, renderPdf });
  }),
);
