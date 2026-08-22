import { Option, Schema } from 'effect';

import {
  AuthenticationRequired,
  CsrfRejected,
  PermissionDenied,
  RequestRateLimited,
} from './authentication.js';
import { ClientArchived, ClientNotFound } from './clients.js';
import {
  DocumentLine,
  DocumentLineInput,
  DocumentLines,
  PositiveSafeInteger,
  SafeInteger,
  documentTotalsFilter,
} from './document-lines.js';
import { DisplayName, Ulid } from './identifiers.js';
import { IsoUtc } from './temporal.js';
import { OrderReference, QuoteReference } from './business-references.js';
export const QuoteLinkToken = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/));
export type QuoteLinkToken = typeof QuoteLinkToken.Type;
const decodeUrl = Schema.decodeOption(Schema.URLFromString);

export const QuoteStatus = Schema.Literals([
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'cancelled',
]);
export type QuoteStatus = typeof QuoteStatus.Type;

export const QuoteLineInput = DocumentLineInput;
export type QuoteLineInput = typeof QuoteLineInput.Type;

const QuoteLinesInput = Schema.Array(QuoteLineInput).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(20),
);
const QuoteTitle = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));
const QuoteConditions = Schema.String.check(Schema.isMaxLength(2_000));

export const DocumentParty = Schema.Struct({
  displayName: DisplayName.check(Schema.isMaxLength(160)),
  addressLine1: Schema.String.check(Schema.isMaxLength(160)),
  addressLine2: Schema.String.check(Schema.isMaxLength(160)),
  postalCode: Schema.String.check(Schema.isMaxLength(32)),
  city: Schema.String.check(Schema.isMaxLength(120)),
  country: Schema.String.check(Schema.isMaxLength(120)),
  email: Schema.String.check(Schema.isMaxLength(254)),
});
export type DocumentParty = typeof DocumentParty.Type;

export const IssuerSettings = Schema.Struct({
  ...DocumentParty.fields,
  phone: Schema.String.check(Schema.isMaxLength(64)),
  registrationNumber: Schema.String.check(Schema.isMaxLength(64)),
  vatNumber: Schema.String.check(Schema.isMaxLength(64)),
});
export type IssuerSettings = typeof IssuerSettings.Type;

export const IssuerSettingsUpdateRequest = IssuerSettings;
export type IssuerSettingsUpdateRequest = typeof IssuerSettingsUpdateRequest.Type;

export const QuoteCreateRequest = Schema.Struct({
  clientId: Ulid,
  title: QuoteTitle,
  conditions: QuoteConditions,
  lines: QuoteLinesInput,
}).annotate({ identifier: 'QuoteCreateRequest' });
export type QuoteCreateRequest = typeof QuoteCreateRequest.Type;

export const QuoteRevisionCreateRequest = Schema.Struct({
  expectedVersion: PositiveSafeInteger,
  title: QuoteTitle,
  conditions: QuoteConditions,
  lines: QuoteLinesInput,
}).annotate({ identifier: 'QuoteRevisionCreateRequest' });
export type QuoteRevisionCreateRequest = typeof QuoteRevisionCreateRequest.Type;

export const QuoteSendRequest = Schema.Struct({ expectedVersion: PositiveSafeInteger });
export type QuoteSendRequest = typeof QuoteSendRequest.Type;

export const QuoteCancellationReason = Schema.Literals([
  'client-declined',
  'scope-changed',
  'budget-unavailable',
  'duplicate',
  'replaced',
  'other',
]);
export type QuoteCancellationReason = typeof QuoteCancellationReason.Type;

export const QuoteCancelRequest = Schema.Struct({
  expectedVersion: PositiveSafeInteger,
  reason: QuoteCancellationReason,
  note: Schema.String.check(Schema.isMaxLength(500)),
});
export type QuoteCancelRequest = typeof QuoteCancelRequest.Type;

export const PublicQuoteAccessRequest = Schema.Struct({ token: QuoteLinkToken });
export type PublicQuoteAccessRequest = typeof PublicQuoteAccessRequest.Type;

const SignerName = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160));
const TypedSignature = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(160));

export const PublicQuoteSignatureRequest = Schema.Struct({
  token: QuoteLinkToken,
  signerName: SignerName,
  consent: Schema.Literal(true),
  signature: Schema.Struct({
    kind: Schema.Literal('typed'),
    value: TypedSignature,
  }),
});
export type PublicQuoteSignatureRequest = typeof PublicQuoteSignatureRequest.Type;

export const QuoteLine = DocumentLine;
export type QuoteLine = typeof QuoteLine.Type;

export const QuoteRenderSnapshot = Schema.Struct({
  templateId: Schema.Literal('quote-default'),
  templateVersion: Schema.Literal(1),
  quoteId: Ulid,
  quoteReference: QuoteReference,
  revisionId: Ulid,
  version: PositiveSafeInteger,
  createdAt: IsoUtc,
  issuer: IssuerSettings,
  client: DocumentParty,
  title: QuoteTitle,
  conditions: QuoteConditions,
  currency: Schema.Literal('EUR'),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
  lines: DocumentLines,
}).check(documentTotalsFilter);
export type QuoteRenderSnapshot = typeof QuoteRenderSnapshot.Type;

export const PublicQuoteConsultation = Schema.Struct({
  status: Schema.Literals(['sent', 'accepted']),
  canSign: Schema.Boolean,
  expiresAt: IsoUtc,
  snapshot: QuoteRenderSnapshot,
});
export type PublicQuoteConsultation = typeof PublicQuoteConsultation.Type;

export const QuoteAcceptanceResult = Schema.Struct({
  quoteId: Ulid,
  revisionId: Ulid,
  signatureId: Ulid,
  orderId: Ulid,
  quoteReference: QuoteReference,
  orderReference: OrderReference,
  status: Schema.Literal('accepted'),
  acceptedAt: IsoUtc,
  evidenceSha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
});
export type QuoteAcceptanceResult = typeof QuoteAcceptanceResult.Type;

export const QuoteRevision = Schema.Struct({
  id: Ulid,
  version: PositiveSafeInteger,
  previewAvailable: Schema.Boolean,
  clientDisplayName: DisplayName,
  title: QuoteTitle,
  conditions: QuoteConditions,
  currency: Schema.Literal('EUR'),
  netTotalCents: SafeInteger,
  vatTotalCents: SafeInteger,
  totalCents: SafeInteger,
  createdAt: IsoUtc,
  createdByUserId: Ulid,
  lines: DocumentLines,
})
  .check(documentTotalsFilter)
  .annotate({ identifier: 'QuoteRevision' });
export type QuoteRevision = typeof QuoteRevision.Type;

export const QuoteSummary = Schema.Struct({
  id: Ulid,
  reference: QuoteReference,
  clientId: Ulid,
  clientDisplayName: DisplayName,
  status: QuoteStatus,
  version: PositiveSafeInteger,
  title: QuoteTitle,
  currency: Schema.Literal('EUR'),
  totalCents: SafeInteger,
  updatedAt: IsoUtc,
}).annotate({ identifier: 'QuoteSummary' });
export type QuoteSummary = typeof QuoteSummary.Type;

export const QuoteDetail = Schema.Struct({
  id: Ulid,
  reference: QuoteReference,
  clientId: Ulid,
  status: QuoteStatus,
  version: PositiveSafeInteger,
  currentRevision: QuoteRevision,
  revisions: Schema.Array(QuoteRevision),
}).annotate({ identifier: 'QuoteDetail' });
export type QuoteDetail = typeof QuoteDetail.Type;

export const QuoteSendResult = Schema.Struct({
  quoteId: Ulid,
  revisionId: Ulid,
  status: Schema.Literal('sent'),
  version: PositiveSafeInteger,
  link: Schema.Struct({
    id: Ulid,
    url: Schema.String.check(
      Schema.makeFilter(
        (value) =>
          Option.exists(decodeUrl(value), (url) => ['http:', 'https:'].includes(url.protocol)),
        { message: 'a valid HTTP URL' },
      ),
      Schema.isMaxLength(2_048),
    ),
    expiresAt: IsoUtc,
  }),
});
export type QuoteSendResult = typeof QuoteSendResult.Type;

export const QuoteList = Schema.Array(QuoteSummary);
export type QuoteList = typeof QuoteList.Type;

export class QuoteNotFound extends Schema.TaggedError<QuoteNotFound>()(
  'QuoteNotFound',
  { code: Schema.Literal('quote.not_found') },
  { httpApiStatus: 404 },
) {}

export class QuoteVersionConflict extends Schema.TaggedError<QuoteVersionConflict>()(
  'QuoteVersionConflict',
  {
    code: Schema.Literal('quote.version_conflict'),
    currentVersion: PositiveSafeInteger,
  },
  { httpApiStatus: 409 },
) {}

export class QuoteAmountTooLarge extends Schema.TaggedError<QuoteAmountTooLarge>()(
  'QuoteAmountTooLarge',
  { code: Schema.Literal('quote.amount_too_large') },
  { httpApiStatus: 422 },
) {}

export class QuoteNotEditable extends Schema.TaggedError<QuoteNotEditable>()(
  'QuoteNotEditable',
  { code: Schema.Literal('quote.not_editable') },
  { httpApiStatus: 409 },
) {}

export class QuotePreviewUnavailable extends Schema.TaggedError<QuotePreviewUnavailable>()(
  'QuotePreviewUnavailable',
  { code: Schema.Literal('quote.preview_unavailable') },
  { httpApiStatus: 409 },
) {}

export class QuotePdfRequired extends Schema.TaggedError<QuotePdfRequired>()(
  'QuotePdfRequired',
  { code: Schema.Literal('quote.pdf_required') },
  { httpApiStatus: 409 },
) {}

export class QuoteLinkNotFound extends Schema.TaggedError<QuoteLinkNotFound>()(
  'QuoteLinkNotFound',
  { code: Schema.Literal('quote_link.not_found') },
  { httpApiStatus: 404 },
) {}

export class QuoteLinkNotSignable extends Schema.TaggedError<QuoteLinkNotSignable>()(
  'QuoteLinkNotSignable',
  { code: Schema.Literal('quote_link.not_signable') },
  { httpApiStatus: 409 },
) {}

export const DocumentArtifact = Schema.Struct({
  id: Ulid,
  quoteReference: QuoteReference,
  revisionId: Ulid,
  kind: Schema.Literal('quote-pdf'),
  contentType: Schema.Literal('application/pdf'),
  byteSize: PositiveSafeInteger,
  sha256: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  createdAt: IsoUtc,
});
export type DocumentArtifact = typeof DocumentArtifact.Type;

export class DocumentNotFound extends Schema.TaggedError<DocumentNotFound>()(
  'DocumentNotFound',
  { code: Schema.Literal('document.not_found') },
  { httpApiStatus: 404 },
) {}

export const QuoteFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  CsrfRejected,
  QuoteNotFound,
  QuoteVersionConflict,
  QuoteAmountTooLarge,
  QuoteNotEditable,
  QuotePreviewUnavailable,
  QuotePdfRequired,
  QuoteLinkNotFound,
  QuoteLinkNotSignable,
  DocumentNotFound,
  ClientNotFound,
  ClientArchived,
  RequestRateLimited,
]);
export type QuoteFailure = typeof QuoteFailure.Type;
