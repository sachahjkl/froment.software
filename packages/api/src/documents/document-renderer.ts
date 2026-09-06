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

import { RuntimeConfiguration } from '../runtime-config.js';

const execFileAsync = promisify(execFile);
const documentTemplate = 'document.typ';
export const DocumentTemporaryDirectory = Context.Reference<string>(
  '@froment/api/DocumentTemporaryDirectory',
  { defaultValue: tmpdir },
);
type DocumentInput = QuoteDocumentInputValue | InvoiceDocumentInputValue | OrderDocumentInputValue;

export class DocumentRenderError extends Schema.TaggedError<DocumentRenderError>()(
  'DocumentRenderError',
  { reason: Schema.Literals(['input', 'compiler', 'output']) },
) {}

export interface DocumentRenderOptions {
  readonly preview: boolean;
}

export interface DocumentRendererService {
  readonly renderQuotePdf: (
    snapshot: QuoteRenderSnapshotValue,
    options?: DocumentRenderOptions,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
  readonly renderInvoicePdf: (
    snapshot: InvoiceRenderSnapshotValue,
    options?: DocumentRenderOptions,
  ) => Effect.Effect<Uint8Array, DocumentRenderError>;
  readonly renderOrderPdf: (
    snapshot: OrderRenderSnapshotValue,
    options?: DocumentRenderOptions,
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
    const temporaryDirectory = yield* DocumentTemporaryDirectory;
    const config = (yield* RuntimeConfiguration).documentRenderer;
    const permits = yield* TxSemaphore.make(config.concurrency);

    const compile = Effect.fn('DocumentRenderer.compile')(function* (
      input: DocumentInput,
      previewTitle?: string,
    ) {
      const json = yield* Effect.try({
        try: () => JSON.stringify(input),
        catch: () => new DocumentRenderError({ reason: 'input' }),
      });
      return yield* TxSemaphore.withPermit(
        permits,
        Effect.acquireUseRelease(
          Effect.tryPromise({
            try: () => mkdtemp(join(temporaryDirectory, 'froment-pdf-')),
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
                  copyFile(
                    join(templatesPath, documentTemplate),
                    join(templateDirectory, documentTemplate),
                  ),
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
                    ...(previewTitle === undefined
                      ? []
                      : ['--input', `preview-title=${previewTitle}`]),
                    '--root',
                    root,
                    '--font-path',
                    fontsPath,
                    '--creation-timestamp',
                    '0',
                    join(templateDirectory, documentTemplate),
                    output,
                  ],
                  {
                    cwd: root,
                    env: {
                      PATH: '',
                      SOURCE_DATE_EPOCH: '0',
                      TYPST_PACKAGE_PATH: join(root, 'packages'),
                    },
                    maxBuffer: config.maximumOutputBytes,
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
      (snapshot: QuoteRenderSnapshotValue, options?: DocumentRenderOptions) =>
        compile(
          prepareQuoteDocument(snapshot),
          options?.preview
            ? `PREVIEW — Devis ${snapshot.quoteReference} — v${snapshot.version} — ${snapshot.title}`
            : undefined,
        ).pipe(Effect.catchDefect(() => new DocumentRenderError({ reason: 'input' }))),
    );
    const renderInvoicePdf = Effect.fn('DocumentRenderer.renderInvoicePdf')(
      (snapshot: InvoiceRenderSnapshotValue, options?: DocumentRenderOptions) =>
        compile(
          prepareInvoiceDocument(snapshot),
          options?.preview
            ? `PREVIEW — Facture ${snapshot.invoiceNumber ?? `brouillon ${snapshot.invoiceId}`} — v${snapshot.version} — ${snapshot.title}`
            : undefined,
        ).pipe(Effect.catchDefect(() => new DocumentRenderError({ reason: 'input' }))),
    );
    const renderOrderPdf = Effect.fn('DocumentRenderer.renderOrderPdf')(
      (snapshot: OrderRenderSnapshotValue, options?: DocumentRenderOptions) =>
        compile(
          prepareOrderDocument(snapshot),
          options?.preview
            ? `PREVIEW — Commande ${snapshot.orderReference} — ${snapshot.title}`
            : undefined,
        ).pipe(Effect.catchDefect(() => new DocumentRenderError({ reason: 'input' }))),
    );

    return DocumentRenderer.of({ renderQuotePdf, renderInvoicePdf, renderOrderPdf });
  }),
);
