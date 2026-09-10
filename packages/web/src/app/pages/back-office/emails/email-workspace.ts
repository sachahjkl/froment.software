import { type ParamMap } from '@angular/router';
import { Schema, Option } from 'effect';
import { CalendarDate, type IntegrationOperationValue, type Reminder } from '@froment/contracts';
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
const EmailSort = Schema.Literals([
  'none',
  'date-desc',
  'date-asc',
  'subject-asc',
  'subject-desc',
  'recipient-asc',
  'recipient-desc',
  'state-asc',
  'state-desc',
]);
export type EmailSortColumn = 'subject' | 'date' | 'recipient' | 'state';
interface EmailSortRow {
  readonly id: string;
  readonly subject: string;
  readonly date: string;
  readonly recipient?: string;
  readonly state?: string;
}
export const emailState = (value: string) =>
  Option.getOrElse(Schema.decodeUnknownOption(EmailState)(value), () => 'all' as const);
export const emailDate = (value: string | null | undefined) =>
  Option.getOrUndefined(Schema.decodeUnknownOption(CalendarDate)(value));
export const emailQuery = (params: ParamMap) => ({
  q: (params.get('q') ?? '').slice(0, 120),
  state: emailState(params.get('state') ?? ''),
  from: emailDate(params.get('from')),
  to: emailDate(params.get('to')),
  sort: Option.getOrElse(
    Schema.decodeUnknownOption(EmailSort)(params.get('sort')),
    () => 'none' as const,
  ),
});
export const emailFilterQuery = (query: ReturnType<typeof emailQuery>) => ({
  ...query,
  sort: query.sort === 'none' ? undefined : query.sort,
});
export const emailDateMatches = (
  timestamp: string,
  query: ReturnType<typeof emailQuery>,
): boolean => {
  const date = new Date(timestamp);
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return (
    (query.from === undefined || day >= query.from) && (query.to === undefined || day <= query.to)
  );
};
export const compareEmailRows = (
  left: EmailSortRow,
  right: EmailSortRow,
  selectedSort: typeof EmailSort.Type,
  language: string,
) => {
  const sort = selectedSort === 'none' ? 'date-desc' : selectedSort;
  const column = sort.startsWith('date-')
    ? 'date'
    : sort.startsWith('recipient-')
      ? 'recipient'
      : sort.startsWith('state-')
        ? 'state'
        : 'subject';
  const comparison =
    column === 'date'
      ? Date.parse(left.date) - Date.parse(right.date)
      : new Intl.Collator(language, { sensitivity: 'base', numeric: true }).compare(
          left[column] ?? '',
          right[column] ?? '',
        );
  return (sort.endsWith('-asc') ? 1 : -1) * comparison || left.id.localeCompare(right.id);
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
