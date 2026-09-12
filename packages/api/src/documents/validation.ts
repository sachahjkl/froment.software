import {
  AccountEmail,
  DocumentIncomplete,
  type DocumentIssueValue,
  type DocumentPartyValue,
} from '@froment/contracts';
import { Schema } from 'effect';

const NonBlank = Schema.String.check(Schema.isPattern(/\S/));
const Phone = Schema.String.check(Schema.isPattern(/^\+?[0-9][0-9 ()\-./]{5,62}$/));
const requiredFields = ['displayName', 'addressLine1', 'city', 'country'] as const;

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
      }
    }
    const { email, phone } = document[party];
    if (party === 'issuer' || phone.trim() === '') {
      if (!Schema.is(NonBlank)(email)) issues.push({ party, field: 'email', reason: 'required' });
      else if (!Schema.is(AccountEmail)(email))
        issues.push({ party, field: 'email', reason: 'invalid_email' });
    } else if (email.trim() !== '' && !Schema.is(AccountEmail)(email)) {
      issues.push({ party, field: 'email', reason: 'invalid_email' });
    }
    if (phone.trim() !== '' && !Schema.is(Phone)(phone))
      issues.push({ party, field: 'phone', reason: 'invalid_phone' });
  }
  if (issues.length > 0) throw new DocumentIncomplete({ code: 'document.incomplete', issues });
};
