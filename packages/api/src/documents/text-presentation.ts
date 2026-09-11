import { DocumentTextPresentation } from '@froment/contracts';
import { Schema } from 'effect';

export const StoredTextPresentation = Schema.NullOr(
  Schema.fromJsonString(DocumentTextPresentation),
);

export const storeTextPresentation = (
  value: DocumentTextPresentation | undefined,
): string | null => (value === undefined ? null : JSON.stringify(value));
