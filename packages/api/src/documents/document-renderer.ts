import { renderInvoiceDefaultTemplate, renderQuoteDefaultTemplate } from '@froment/documents';
import { type InvoiceRenderSnapshotValue, type QuoteRenderSnapshotValue } from '@froment/contracts';
import { Config, Context, Effect, Layer, Schema, TxSemaphore } from 'effect';
import { chromium } from 'playwright-core';

export class DocumentRenderError extends Schema.TaggedError<DocumentRenderError>()(
  'DocumentRenderError',
  { cause: Schema.Defect() },
) {}

export interface DocumentRendererService {
  readonly renderQuote: (
    snapshot: QuoteRenderSnapshotValue,
  ) => Effect.Effect<string, DocumentRenderError>;
  readonly renderQuotePdf: (
    snapshot: QuoteRenderSnapshotValue,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
  readonly renderInvoice: (
    snapshot: InvoiceRenderSnapshotValue,
  ) => Effect.Effect<string, DocumentRenderError>;
  readonly renderInvoicePdf: (
    snapshot: InvoiceRenderSnapshotValue,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
}

export class DocumentRenderer extends Context.Service<DocumentRenderer, DocumentRendererService>()(
  '@froment/api/DocumentRenderer',
) {}

export const DocumentRendererLive = Layer.effect(
  DocumentRenderer,
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

    const render = Effect.fn('DocumentRenderer.render')(function* <Snapshot>(
      snapshot: Snapshot,
      renderTemplate: (value: Snapshot) => Promise<string>,
    ) {
      return yield* Effect.tryPromise({
        try: () => renderTemplate(snapshot),
        catch: (cause) => new DocumentRenderError({ cause }),
      });
    });

    const renderPdf = Effect.fn('DocumentRenderer.renderPdf')(function* (html: string) {
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

    const renderQuote = Effect.fn('DocumentRenderer.renderQuote')(
      (snapshot: QuoteRenderSnapshotValue) => render(snapshot, renderQuoteDefaultTemplate),
    );
    const renderQuotePdf = Effect.fn('DocumentRenderer.renderQuotePdf')(function* (
      snapshot: QuoteRenderSnapshotValue,
    ) {
      return yield* renderPdf(yield* renderQuote(snapshot));
    });
    const renderInvoice = Effect.fn('DocumentRenderer.renderInvoice')(
      (snapshot: InvoiceRenderSnapshotValue) => render(snapshot, renderInvoiceDefaultTemplate),
    );
    const renderInvoicePdf = Effect.fn('DocumentRenderer.renderInvoicePdf')(function* (
      snapshot: InvoiceRenderSnapshotValue,
    ) {
      return yield* renderPdf(yield* renderInvoice(snapshot));
    });

    return DocumentRenderer.of({
      renderQuote,
      renderQuotePdf,
      renderInvoice,
      renderInvoicePdf,
    });
  }),
);
