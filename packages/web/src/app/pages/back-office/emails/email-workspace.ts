import { type ParamMap } from '@angular/router';
import { Schema, Option } from 'effect';
import { type IntegrationOperationValue, type Reminder } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';

export const emailViews = ['messages', 'drafts', 'reminders', 'templates'] as const;
export type EmailView = (typeof emailViews)[number];
const EmailView = Schema.Literals(emailViews);
export const emailView = (value: string | null | undefined): EmailView =>
  Option.getOrElse(Schema.decodeUnknownOption(EmailView)(value), () => 'messages' as const);
export const emailStateLabels = {
  all: 'emailsWorkspace.allStates',
  pending: 'integrations.pending',
  simulated: 'emailsWorkspace.simulated',
  submitted: 'emailsWorkspace.submitted',
  draft: 'emailsWorkspace.draft',
  reminder: 'emailsWorkspace.reminderDraft',
  scheduled: 'reminder.scheduled',
  cancelled: 'reminder.cancelled',
  skipped: 'reminder.skipped',
  queued: 'reminder.queued',
} satisfies Record<string, TranslationKey>;
export const EmailState = Schema.Literals([
  'all',
  'pending',
  'simulated',
  'submitted',
  'draft',
  'reminder',
  'scheduled',
  'cancelled',
  'skipped',
  'queued',
]);
const EmailSort = Schema.Literals(['date-desc', 'date-asc', 'subject-asc', 'subject-desc']);
export const emailState = (value: string) =>
  Option.getOrElse(Schema.decodeUnknownOption(EmailState)(value), () => 'all' as const);
export const emailQuery = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 120),
  state: emailState(params.get('state') ?? ''),
  sort: Option.getOrElse(
    Schema.decodeUnknownOption(EmailSort)(params.get('sort')),
    () => 'date-desc' as const,
  ),
});
export const compareEmailRows = (
  left: readonly [string, string],
  right: readonly [string, string],
  sort: typeof EmailSort.Type,
  language: string,
) => {
  const index = sort.startsWith('date-') ? 1 : 0;
  return (sort.endsWith('-asc') ? 1 : -1) * left[index].localeCompare(right[index], language);
};
export const messageStatus = (operation: IntegrationOperationValue): TranslationKey =>
  operation.receipt === null
    ? 'integrations.pending'
    : operation.receipt.mode === 'simulation'
      ? 'emailsWorkspace.simulated'
      : 'emailsWorkspace.submitted';
export const reminderStatuses = {
  scheduled: 'reminder.scheduled',
  cancelled: 'reminder.cancelled',
  skipped: 'reminder.skipped',
  queued: 'reminder.queued',
} satisfies Record<(typeof Reminder.Type)['status'], TranslationKey>;
export const reminderReasons = {
  'invoice-ineligible': 'reminder.invoice-ineligible',
  'recipient-invalid': 'reminder.recipient-invalid',
  'permission-revoked': 'reminder.permission-revoked',
  'mode-changed': 'reminder.mode-changed',
} satisfies Record<NonNullable<(typeof Reminder.Type)['reason']>, TranslationKey>;
