import {
  SupplierInvoiceAnalysisSettings,
  SupplierInvoiceAnalysisRequest,
  SupplierInvoiceAnalysisSettingsUpdate,
  SupplierInvoiceConflict,
  SupplierInvoiceLineInput,
  SupplierInvoiceMaximumLineCount,
  SupplierInvoiceMaximumNotesLength,
  SupplierInvoiceMaximumReferenceLength,
  SupplierInvoiceMinimumLineCount,
  type UlidValue,
} from '@froment/contracts';
import { Clock, Context, DateTime, Effect, Layer, Option, Redacted, Schema } from 'effect';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { ulid } from 'ulid';

import { Audit } from '../audit/audit.js';
import { Database, DatabaseError } from '../database/database.js';
import { RuntimeConfiguration } from '../runtime-config.js';
import { SupplierInvoices } from './service.js';

const analysisSettingsId = 1;
const encryptionKeyBytes = 32;
const encryptionIvBytes = 12;
const encryptionAlgorithm = 'aes-256-gcm';
const sha256Algorithm = 'sha256';
const submissionMetadata = (
  adapter: 'local' | 'http',
  endpointHost: string | null,
  bytes: number,
) => {
  const common = { adapter, contentBytes: String(bytes) };
  return endpointHost === null ? common : { ...common, endpointHost };
};

const SettingsRow = Schema.Struct({
  adapter: Schema.Literals(['local', 'http']),
  endpoint: Schema.NullOr(Schema.String),
  encryptedApiKey: Schema.NullOr(Schema.String),
  encryptionIv: Schema.NullOr(Schema.String),
  encryptionTag: Schema.NullOr(Schema.String),
  updatedAt: Schema.NullOr(Schema.Int),
});
const PriorSubmission = Schema.Struct({
  invoiceId: Schema.NullOr(Schema.String),
  contentSha256: Schema.String,
  status: Schema.Literals(['submitted', 'completed', 'failed']),
});
const SupplierRow = Schema.Struct({
  defaultCurrency: Schema.String,
  paymentTermsDays: Schema.Int,
});
const AnalysisOutput = Schema.Struct({
  reference: Schema.String.check(
    Schema.isPattern(/\S/),
    Schema.isMaxLength(SupplierInvoiceMaximumReferenceLength),
  ),
  invoiceDate: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  dueDate: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)),
  currency: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)),
  lines: Schema.Array(SupplierInvoiceLineInput).check(
    Schema.isMinLength(SupplierInvoiceMinimumLineCount),
    Schema.isMaxLength(SupplierInvoiceMaximumLineCount),
  ),
  notes: Schema.String.check(Schema.isMaxLength(SupplierInvoiceMaximumNotesLength)),
});

const make = Effect.gen(function* () {
  const { sqlite } = yield* Database;
  const audit = yield* Audit;
  const invoices = yield* SupplierInvoices;
  const config = yield* RuntimeConfiguration;

  const settingsRow = () =>
    Schema.decodeUnknownSync(SettingsRow)(
      sqlite
        .prepare(
          `select adapter, endpoint, encrypted_api_key as encryptedApiKey,
           encryption_iv as encryptionIv, encryption_tag as encryptionTag, updated_at as updatedAt
           from supplier_invoice_analysis_settings where id = ?`,
        )
        .get(analysisSettingsId),
    );

  const configuredApiKey = config.supplierInvoiceAnalysis.apiKey;
  const credentialsPresent = (row: typeof SettingsRow.Type) =>
    row.encryptedApiKey !== null || Option.isSome(configuredApiKey);

  const key = () => {
    const configured = config.secrets.settingsEncryptionKey;
    if (Option.isNone(configured)) {
      throw new SupplierInvoiceConflict({ code: 'supplier_invoice.encryption_unavailable' });
    }
    const value = Buffer.from(Redacted.value(configured.value), 'base64');
    if (value.length !== encryptionKeyBytes) {
      throw new SupplierInvoiceConflict({ code: 'supplier_invoice.encryption_unavailable' });
    }
    return value;
  };

  const encrypt = (secret: string) => {
    const iv = randomBytes(encryptionIvBytes);
    const cipher = createCipheriv(encryptionAlgorithm, key(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return {
      encryptedApiKey: encrypted.toString('base64'),
      encryptionIv: iv.toString('base64'),
      encryptionTag: cipher.getAuthTag().toString('base64'),
    };
  };

  const decrypt = (row: typeof SettingsRow.Type) => {
    if (row.encryptedApiKey === null || row.encryptionIv === null || row.encryptionTag === null) {
      if (Option.isSome(configuredApiKey)) return Redacted.value(configuredApiKey.value);
      throw new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_not_configured' });
    }
    try {
      const decipher = createDecipheriv(
        encryptionAlgorithm,
        key(),
        Buffer.from(row.encryptionIv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(row.encryptionTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(row.encryptedApiKey, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch (cause) {
      if (cause instanceof SupplierInvoiceConflict) throw cause;
      throw new SupplierInvoiceConflict({ code: 'supplier_invoice.encryption_unavailable' });
    }
  };

  const getSettings = Effect.fn('SupplierInvoiceAnalysis.getSettings')(function* () {
    return yield* Effect.try({
      try: () => {
        const row = settingsRow();
        return Schema.decodeUnknownSync(SupplierInvoiceAnalysisSettings)({
          adapter: row.adapter,
          endpoint: row.endpoint,
          credentialsPresent: credentialsPresent(row),
          external: row.adapter === 'http',
          updatedAt: row.updatedAt,
        });
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'supplier-invoice-analysis.settings', cause }),
    });
  });

  const updateSettings = Effect.fn('SupplierInvoiceAnalysis.updateSettings')(function* (
    request: typeof SupplierInvoiceAnalysisSettingsUpdate.Type,
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    return yield* Effect.try({
      try: () => {
        if (request.adapter === 'http' && request.endpoint === null) {
          throw new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_not_configured' });
        }
        const current = settingsRow();
        const secret =
          request.apiKey === undefined
            ? {
                encryptedApiKey: current.encryptedApiKey,
                encryptionIv: current.encryptionIv,
                encryptionTag: current.encryptionTag,
              }
            : request.apiKey.length === 0
              ? { encryptedApiKey: null, encryptionIv: null, encryptionTag: null }
              : encrypt(request.apiKey);
        sqlite
          .prepare(
            `update supplier_invoice_analysis_settings set adapter = ?, endpoint = ?,
              encrypted_api_key = ?, encryption_iv = ?, encryption_tag = ?, updated_at = ? where id = ?`,
          )
          .run(
            request.adapter,
            request.adapter === 'http' ? request.endpoint : null,
            secret.encryptedApiKey,
            secret.encryptionIv,
            secret.encryptionTag,
            now,
            analysisSettingsId,
          );
        audit.insert({
          action: 'supplier-invoice.analysis-settings-updated',
          actorUserId,
          resourceType: 'supplier-invoice-analysis-settings',
          resourceId: String(analysisSettingsId),
          occurredAt: now,
        });
        const row = settingsRow();
        return Schema.decodeUnknownSync(SupplierInvoiceAnalysisSettings)({
          adapter: row.adapter,
          endpoint: row.endpoint,
          credentialsPresent: credentialsPresent(row),
          external: row.adapter === 'http',
          updatedAt: row.updatedAt,
        });
      },
      catch: (cause) =>
        cause instanceof SupplierInvoiceConflict
          ? cause
          : new DatabaseError({ operation: 'supplier-invoice-analysis.settings-update', cause }),
    });
  });

  const externalAnalysis = Effect.fn('SupplierInvoiceAnalysis.external')(function* (
    endpoint: string,
    apiKey: string,
    request: typeof SupplierInvoiceAnalysisRequest.Type,
  ) {
    const response = yield* Effect.tryPromise({
      try: (signal) =>
        fetch(endpoint, {
          method: 'POST',
          signal,
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            fileName: request.fileName,
            mediaType: request.mediaType,
            contentBase64: request.contentBase64,
          }),
        }),
      catch: () => new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_failed' }),
    }).pipe(
      Effect.timeout(config.supplierInvoiceAnalysis.requestTimeoutMillis),
      Effect.mapError(
        () => new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_failed' }),
      ),
    );
    if (!response.ok) {
      return yield* new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_failed' });
    }
    const body = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: () => new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_failed' }),
    });
    return yield* Schema.decodeUnknownEffect(AnalysisOutput)(body).pipe(
      Effect.mapError(
        () => new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_failed' }),
      ),
    );
  });

  const analyze = Effect.fn('SupplierInvoiceAnalysis.analyze')(function* (
    request: typeof SupplierInvoiceAnalysisRequest.Type,
    actorUserId: UlidValue,
  ) {
    const now = yield* Clock.currentTimeMillis;
    const nowDateTime = DateTime.makeUnsafe(now);
    const content = Buffer.from(request.contentBase64, 'base64');
    const hash = createHash(sha256Algorithm).update(content).digest('hex');
    const prior = sqlite
      .prepare(
        `select invoice_id as invoiceId, content_sha256 as contentSha256, status
         from supplier_invoice_analysis_submissions where request_id = ?`,
      )
      .get(request.requestId);
    if (prior !== undefined) {
      const decoded = Schema.decodeUnknownSync(PriorSubmission)(prior);
      if (decoded.contentSha256 !== hash) {
        return yield* new SupplierInvoiceConflict({ code: 'supplier_invoice.creation_conflict' });
      }
      if (decoded.status === 'completed' && decoded.invoiceId !== null) {
        return yield* invoices.get(decoded.invoiceId);
      }
      return yield* new SupplierInvoiceConflict({ code: 'supplier_invoice.analysis_failed' });
    }
    const settings = settingsRow();
    if (settings.adapter === 'http' && !request.consent) {
      return yield* new SupplierInvoiceConflict({
        code: 'supplier_invoice.analysis_consent_required',
      });
    }
    const supplier = yield* Effect.try({
      try: () => {
        const row = sqlite
          .prepare(
            `select default_currency as defaultCurrency, payment_terms_days as paymentTermsDays
             from suppliers where id = ? and archived = 0`,
          )
          .get(request.supplierId);
        if (row === undefined) {
          throw new SupplierInvoiceConflict({ code: 'supplier_invoice.supplier_unavailable' });
        }
        return Schema.decodeUnknownSync(SupplierRow)(row);
      },
      catch: (cause) =>
        cause instanceof SupplierInvoiceConflict
          ? cause
          : new DatabaseError({ operation: 'supplier-invoice-analysis.supplier', cause }),
    });
    const submissionId = ulid();
    const endpointHost =
      settings.adapter === 'http' && settings.endpoint !== null
        ? new URL(settings.endpoint).host
        : null;
    yield* Effect.try({
      try: () => {
        sqlite
          .prepare(
            `insert into supplier_invoice_analysis_submissions
             (id, request_id, supplier_id, actor_user_id, adapter, endpoint_host, file_name,
              media_type, content_sha256, content_bytes, consent_at, status, created_at)
             values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
          )
          .run(
            submissionId,
            request.requestId,
            request.supplierId,
            actorUserId,
            settings.adapter,
            endpointHost,
            request.fileName,
            request.mediaType,
            hash,
            content.length,
            request.consent ? now : null,
            now,
          );
        audit.insert({
          action: 'supplier-invoice.analysis-submitted',
          actorUserId,
          resourceType: 'supplier-invoice-analysis-submission',
          resourceId: submissionId,
          metadata: submissionMetadata(settings.adapter, endpointHost, content.length),
          occurredAt: now,
        });
      },
      catch: (cause) =>
        new DatabaseError({ operation: 'supplier-invoice-analysis.submission', cause }),
    });
    const invoiceDate = DateTime.formatIsoDateUtc(nowDateTime);
    const localOutput = {
      reference:
        request.fileName
          .replace(/\.[^.]+$/, '')
          .trim()
          .slice(0, SupplierInvoiceMaximumReferenceLength) || 'OCR',
      invoiceDate,
      dueDate: DateTime.formatIsoDateUtc(
        nowDateTime.pipe(DateTime.add({ days: supplier.paymentTermsDays })),
      ),
      currency: supplier.defaultCurrency,
      lines: [{ description: request.fileName, netTotalCents: 0, vatRateBasisPoints: 0 }],
      notes: '',
    };
    return yield* Effect.gen(function* () {
      let output: typeof AnalysisOutput.Type;
      if (settings.adapter === 'local') {
        output = Schema.decodeUnknownSync(AnalysisOutput)(localOutput);
      } else {
        const endpoint = settings.endpoint;
        if (endpoint === null) {
          return yield* new SupplierInvoiceConflict({
            code: 'supplier_invoice.analysis_not_configured',
          });
        }
        output = yield* externalAnalysis(endpoint, decrypt(settings), request);
      }
      const invoice = yield* invoices.create(
        {
          requestId: request.requestId,
          supplierId: request.supplierId,
          ...output,
          source: 'ocr',
          sourceFileName: request.fileName,
          externalSubmissionId: settings.adapter === 'http' ? submissionId : null,
        },
        actorUserId,
      );
      const completedAt = yield* Clock.currentTimeMillis;
      yield* Effect.try({
        try: () =>
          sqlite
            .prepare(
              `update supplier_invoice_analysis_submissions set invoice_id = ?, status = 'completed',
               completed_at = ? where id = ?`,
            )
            .run(invoice.id, completedAt, submissionId),
        catch: (cause) =>
          new DatabaseError({ operation: 'supplier-invoice-analysis.complete', cause }),
      });
      return invoice;
    }).pipe(
      Effect.tapError((error) =>
        Effect.gen(function* () {
          const failedAt = yield* Clock.currentTimeMillis;
          sqlite
            .prepare(
              `update supplier_invoice_analysis_submissions set status = 'failed', error_code = ?,
               completed_at = ? where id = ?`,
            )
            .run(
              error instanceof SupplierInvoiceConflict
                ? error.code
                : 'supplier_invoice.analysis_failed',
              failedAt,
              submissionId,
            );
        }),
      ),
    );
  });

  const getStatus = Effect.fn('SupplierInvoiceAnalysis.getStatus')(function* () {
    const settings = yield* getSettings();
    return { external: settings.external } as const;
  });

  return { getSettings, getStatus, updateSettings, analyze };
});

export class SupplierInvoiceAnalysis extends Context.Service<
  SupplierInvoiceAnalysis,
  Effect.Success<typeof make>
>()('@froment/api/SupplierInvoiceAnalysis') {}
export const SupplierInvoiceAnalysisLive = Layer.effect(SupplierInvoiceAnalysis, make);
