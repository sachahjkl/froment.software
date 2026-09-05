import {
  AccountEmail,
  DocumentIncomplete,
  type DocumentIssueValue,
  type DocumentPartyValue,
} from '@froment/contracts';
import { Schema } from 'effect';

const NonBlank = Schema.String.check(Schema.isPattern(/\S/));
const requiredFields = ['displayName', 'addressLine1', 'city', 'country', 'email'] as const;

export const validateDocumentParties = (document: {
  readonly issuer: DocumentPartyValue;
  readonly client: DocumentPartyValue;
}): void => {
  const issues: Array<DocumentIssueValue> = [];
  for (const party of ['issuer', 'client'] as const) {
    for (const field of requiredFields) {
      const value = document[party][field];
      if (!Schema.is(NonBlank)(value)) {
        issues.push({ party, field, reason: 'required' });
      } else if (field === 'email' && !Schema.is(AccountEmail)(value)) {
        issues.push({ party, field, reason: 'invalid_email' });
      }
    }
  }
  if (issues.length > 0) throw new DocumentIncomplete({ code: 'document.incomplete', issues });
};
