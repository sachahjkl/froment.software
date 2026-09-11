import { Schema } from 'effect';
import {
  DocumentTextPresentation,
  documentTextContent,
  isDocumentText,
} from '../documents/document-text.js';

import {
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
} from '../authentication/contracts.js';
import { Ulid } from '../identifiers.js';

const Name = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(120));
const Conditions = Schema.String.check(Schema.isPattern(/\S/), Schema.isMaxLength(2_000));
const conditionsFilter = Schema.makeFilter<{
  readonly conditions: string;
  readonly conditionsPresentation?: DocumentTextPresentation;
}>(
  (value) =>
    (isDocumentText(value.conditions, value.conditionsPresentation?.format ?? 'plain') &&
      /\S/.test(documentTextContent(value.conditions, value.conditionsPresentation))) ||
    'document.conditions_format.invalid',
);

export const QuoteConditionPreset = Schema.Struct({
  id: Ulid,
  name: Name,
  conditions: Conditions,
  conditionsPresentation: Schema.optionalKey(DocumentTextPresentation),
}).check(conditionsFilter);
export type QuoteConditionPreset = typeof QuoteConditionPreset.Type;

export const QuoteConditionPresetList = Schema.Array(QuoteConditionPreset);
export type QuoteConditionPresetList = typeof QuoteConditionPresetList.Type;

export const QuoteConditionPresetWriteRequest = Schema.Struct({
  name: Name,
  conditions: Conditions,
  conditionsPresentation: Schema.optionalKey(DocumentTextPresentation),
}).check(conditionsFilter);
export type QuoteConditionPresetWriteRequest = typeof QuoteConditionPresetWriteRequest.Type;

export class QuoteConditionPresetNotFound extends Schema.TaggedError<QuoteConditionPresetNotFound>()(
  'QuoteConditionPresetNotFound',
  { code: Schema.Literal('quote_condition_preset.not_found') },
  { httpApiStatus: 404 },
) {}

export class QuoteConditionPresetNameConflict extends Schema.TaggedError<QuoteConditionPresetNameConflict>()(
  'QuoteConditionPresetNameConflict',
  { code: Schema.Literal('quote_condition_preset.name_conflict') },
  { httpApiStatus: 409 },
) {}

export const QuoteConditionPresetFailure = Schema.Union([
  AuthenticationRequired,
  PermissionDenied,
  RequestRateLimited,
  QuoteConditionPresetNotFound,
  QuoteConditionPresetNameConflict,
]);
export type QuoteConditionPresetFailure = typeof QuoteConditionPresetFailure.Type;
