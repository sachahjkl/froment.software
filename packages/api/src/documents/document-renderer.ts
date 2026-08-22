import {
  prepareInvoiceDocument,
  prepareOrderDocument,
  prepareQuoteDocument,
  type InvoiceDocumentInputValue,
  type OrderDocumentInputValue,
  type QuoteDocumentInputValue,
} from '@froment/documents';
import {
  type InvoiceRenderSnapshotValue,
  type OrderRenderSnapshotValue,
  type QuoteRenderSnapshotValue,
} from '@froment/contracts';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Config, Context, Effect, Layer, Schema, TxSemaphore } from 'effect';

const execFileAsync = promisify(execFile);
type DocumentInput = QuoteDocumentInputValue | InvoiceDocumentInputValue | OrderDocumentInputValue;

export class DocumentRenderError extends Schema.TaggedError<DocumentRenderError>()(
  'DocumentRenderError',
  { reason: Schema.Literals(['input', 'compiler', 'output']) },
) {}

export interface DocumentRendererService {
  readonly renderQuotePdf: (
    snapshot: QuoteRenderSnapshotValue,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
  readonly renderInvoicePdf: (
    snapshot: InvoiceRenderSnapshotValue,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
  readonly renderOrderPdf: (
    snapshot: OrderRenderSnapshotValue,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
}

export class DocumentRenderer extends Context.Service<DocumentRenderer, DocumentRendererService>()(
  '@froment/api/DocumentRenderer',
) {}

export const DocumentRendererLive = Layer.effect(
  DocumentRenderer,
  Effect.gen(function* () {
    const executable = yield* Config.string('TYPST_PATH');
    const templatesPath = yield* Config.string('DOCUMENT_TEMPLATES_PATH');
    const fontsPath = yield* Config.string('DOCUMENT_FONTS_PATH');
    const permits = yield* TxSemaphore.make(2);

    const compile = Effect.fn('DocumentRenderer.compile')(function* (
      template: 'quote.typ' | 'invoice.typ' | 'order.typ',
      input: DocumentInput,
    ) {
      const json = yield* Effect.try({
        try: () => JSON.stringify(input),
        catch: () => new DocumentRenderError({ reason: 'input' }),
      });
      return yield* TxSemaphore.withPermit(
        permits,
        Effect.acquireUseRelease(
          Effect.tryPromise({
            try: () => mkdtemp(join(tmpdir(), 'froment-pdf-')),
            catch: () => new DocumentRenderError({ reason: 'output' }),
          }),
          (root) =>
            Effect.tryPromise({
              try: async () => {
                const inputDirectory = join(root, 'input');
                const outputDirectory = join(root, 'output');
                const templateDirectory = join(root, 'templates');
                await Promise.all([
                  mkdir(inputDirectory),
                  mkdir(outputDirectory),
                  mkdir(templateDirectory),
                ]);
                await Promise.all([
                  copyFile(join(templatesPath, template), join(templateDirectory, template)),
                  copyFile(
                    join(templatesPath, 'shared.typ'),
                    join(templateDirectory, 'shared.typ'),
                  ),
                ]);
                await writeFile(join(inputDirectory, 'document.json'), json, {
                  encoding: 'utf8',
                  mode: 0o600,
                });
                const output = join(outputDirectory, 'document.pdf');
                await execFileAsync(
                  executable,
                  [
                    'compile',
                    '--root',
                    root,
                    '--font-path',
                    fontsPath,
                    '--creation-timestamp',
                    '0',
                    join(templateDirectory, template),
                    output,
                  ],
                  {
                    cwd: root,
                    env: {
                      PATH: '',
                      SOURCE_DATE_EPOCH: '0',
                      TYPST_PACKAGE_PATH: join(root, 'packages'),
                    },
                    maxBuffer: 1024 * 1024,
                  },
                );
                const pdf = await readFile(output);
                if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
                  throw new DocumentRenderError({ reason: 'output' });
                }
                return new Uint8Array(pdf);
              },
              catch: (error) =>
                error instanceof DocumentRenderError
                  ? error
                  : new DocumentRenderError({ reason: 'compiler' }),
            }),
          (root) => Effect.promise(() => rm(root, { recursive: true, force: true })),
        ),
      );
    });

    const renderQuotePdf = Effect.fn('DocumentRenderer.renderQuotePdf')(
      (snapshot: QuoteRenderSnapshotValue) =>
        compile('quote.typ', prepareQuoteDocument(snapshot)).pipe(
          Effect.catchDefect(() => new DocumentRenderError({ reason: 'input' })),
        ),
    );
    const renderInvoicePdf = Effect.fn('DocumentRenderer.renderInvoicePdf')(
      (snapshot: InvoiceRenderSnapshotValue) =>
        compile('invoice.typ', prepareInvoiceDocument(snapshot)).pipe(
          Effect.catchDefect(() => new DocumentRenderError({ reason: 'input' })),
        ),
    );
    const renderOrderPdf = Effect.fn('DocumentRenderer.renderOrderPdf')(
      (snapshot: OrderRenderSnapshotValue) =>
        compile('order.typ', prepareOrderDocument(snapshot)).pipe(
          Effect.catchDefect(() => new DocumentRenderError({ reason: 'input' })),
        ),
    );

    return DocumentRenderer.of({ renderQuotePdf, renderInvoicePdf, renderOrderPdf });
  }),
);
