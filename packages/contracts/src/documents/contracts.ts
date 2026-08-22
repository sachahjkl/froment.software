import { Schema } from 'effect';

import { QuoteReference } from '../business/contracts.js';
import { PositiveSafeInteger } from './lines.js';
import { DisplayName, Ulid } from '../identifiers.js';
import { IsoUtc } from '../temporal.js';

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

export class QuotePreviewUnavailable extends Schema.TaggedError<QuotePreviewUnavailable>()(
  'QuotePreviewUnavailable',
  { code: Schema.Literal('quote.preview_unavailable') },
  { httpApiStatus: 409 },
) {}
