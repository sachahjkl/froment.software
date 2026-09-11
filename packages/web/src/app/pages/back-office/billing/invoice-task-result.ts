import type {
  InvoiceCreditFailure,
  InvoiceFailureValue,
  RequestInvalidOrigin,
  RequestTooLarge,
} from '@froment/contracts';

export type InvoiceTaskOperation =
  | 'issue'
  | 'void'
  | 'record-payment'
  | 'cancel-payment'
  | 'issue-credit'
  | 'refund'
  | 'cancel-refund';

type TaskFailureCode =
  | InvoiceFailureValue['code']
  | (typeof InvoiceCreditFailure.Type)['code']
  | RequestInvalidOrigin['code']
  | RequestTooLarge['code'];
type FailureKind = 'boundary' | 'business' | 'unknown';
export type InvoiceFailureResolution = 'attempt-rejected' | 'request-rejected' | 'unknown';

const failureKinds = new Map<string, FailureKind>(
  Object.entries({
    'authentication.required': 'boundary',
    'authentication.permission_denied': 'boundary',
    'request.rate_limited': 'boundary',
    'request.invalid_origin': 'boundary',
    'request.too_large': 'boundary',
    'invoice.credit_conflict': 'business',
    'invoice.credit_request_conflict': 'business',
    'invoice.payment_invalid': 'business',
    'invoice.not_found': 'business',
    'invoice.version_conflict': 'business',
    'invoice.invalid_dates': 'business',
    'invoice.invalid_transition': 'business',
    'document.incomplete': 'business',
    'invoice.order_not_found': 'unknown',
    'invoice.already_exists': 'unknown',
    'invoice.not_editable': 'unknown',
    'invoice.amount_too_large': 'unknown',
    'document.not_found': 'unknown',
  } satisfies Record<TaskFailureCode, FailureKind>),
);

// Only failures that exclude an earlier write can resolve an uncertain request.
const requestRejections = {
  issue: ['invoice.invalid_dates', 'document.incomplete'],
  void: ['invoice.invalid_transition'],
  'record-payment': ['invoice.version_conflict', 'invoice.invalid_transition'],
  'cancel-payment': ['invoice.invalid_transition'],
  'issue-credit': ['invoice.credit_conflict'],
  refund: ['invoice.credit_conflict'],
  'cancel-refund': ['invoice.credit_conflict'],
} satisfies Record<InvoiceTaskOperation, ReadonlyArray<TaskFailureCode>>;

export const invoiceFailureResolution = (
  operation: InvoiceTaskOperation,
  code: string | undefined,
): InvoiceFailureResolution => {
  const kind = code === undefined ? 'unknown' : (failureKinds.get(code) ?? 'unknown');
  switch (kind) {
    case 'unknown':
      return 'unknown';
    case 'boundary':
      return 'attempt-rejected';
    case 'business':
      return requestRejections[operation].some((rejection) => rejection === code)
        ? 'request-rejected'
        : 'attempt-rejected';
  }
};
