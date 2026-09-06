import {
  EmailActions,
  SignatureActions,
  PaymentActions,
  BankingActions,
  ElectronicInvoiceActions,
  EmailDelivery,
  SignatureStatus,
  ProviderPayment,
  ProviderRefund,
  BankConnection,
  ElectronicInvoiceStatus,
  ElectronicReport,
  IntegrationInvalid,
} from '@froment/contracts';
import { Effect, Schema } from 'effect';

const mock = <Request extends { readonly requestId: string }, Preview>(
  schema: Schema.Schema<Request>,
  preview: Preview,
) =>
  Effect.fn('Provider.mockAction')(function* (request: Request) {
    if (!Schema.is(schema)(request))
      return yield* new IntegrationInvalid({ code: 'integration.invalid_request' });
    return {
      mode: 'simulation' as const,
      executed: false as const,
      requestId: request.requestId,
      preview: structuredClone(preview),
    };
  });
const updatedAt = '2026-01-01T00:00:00.000Z';
const events = { items: [], nextCursor: null };
const webhook = { verified: false, events: [] };
const file = { available: false as const };
const email: typeof EmailDelivery.Type = {
  providerId: 'mock:email',
  status: 'queued',
  recipient: 'recipient@example.test',
  updatedAt,
  failureCode: null,
};
const signature: typeof SignatureStatus.Type = {
  providerId: 'mock:signature',
  artifactId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status: 'pending',
  signers: [{ email: 'signer@example.test', status: 'pending', signedAt: null }],
  updatedAt,
};
const payment: typeof ProviderPayment.Type = {
  providerId: 'mock:payment',
  status: 'pending',
  amountCents: 12500,
  capturedCents: 0,
  refundedCents: 0,
  currency: 'EUR',
  checkoutUrl: null,
  updatedAt,
};
const refund: typeof ProviderRefund.Type = {
  providerId: 'mock:refund',
  paymentId: 'mock:payment',
  amountCents: 12500,
  currency: 'EUR',
  status: 'pending',
  updatedAt,
};
const connection: typeof BankConnection.Type = {
  providerId: 'mock:connection',
  status: 'pending-consent',
  consentUrl: null,
  expiresAt: null,
};
const invoice: typeof ElectronicInvoiceStatus.Type = {
  providerId: 'mock:electronic-invoice',
  artifactId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  status: 'submitted',
  direction: 'outgoing',
  updatedAt,
  rejectionCode: null,
};
const report: typeof ElectronicReport.Type = {
  providerId: 'mock:report',
  from: '2026-01-01',
  to: '2026-01-31',
  status: 'submitted',
  rejectionCode: null,
};

export const EmailMockActions = {
  get: mock(EmailActions.get.request, email),
  cancel: mock(EmailActions.cancel.request, { ...email, status: 'cancelled' as const }),
  events: mock(EmailActions.events.request, events),
  verifyWebhook: mock(EmailActions.verifyWebhook.request, webhook),
};
export const SignatureMockActions = {
  get: mock(SignatureActions.get.request, signature),
  cancel: mock(SignatureActions.cancel.request, { ...signature, status: 'cancelled' as const }),
  remind: mock(SignatureActions.remind.request, signature),
  signedDocument: mock(SignatureActions.signedDocument.request, file),
  proof: mock(SignatureActions.proof.request, file),
  events: mock(SignatureActions.events.request, events),
  verifyWebhook: mock(SignatureActions.verifyWebhook.request, webhook),
};
export const PaymentMockActions = {
  get: mock(PaymentActions.get.request, payment),
  cancel: mock(PaymentActions.cancel.request, { ...payment, status: 'cancelled' as const }),
  capture: mock(PaymentActions.capture.request, {
    ...payment,
    status: 'captured' as const,
    capturedCents: payment.amountCents,
  }),
  refund: mock(PaymentActions.refund.request, refund),
  getRefund: mock(PaymentActions.getRefund.request, refund),
  events: mock(PaymentActions.events.request, events),
  verifyWebhook: mock(PaymentActions.verifyWebhook.request, webhook),
};
export const BankingMockActions = {
  connect: mock(BankingActions.connect.request, connection),
  getConnection: mock(BankingActions.getConnection.request, connection),
  revokeConnection: mock(BankingActions.revokeConnection.request, {
    ...connection,
    status: 'revoked' as const,
  }),
  accounts: mock(BankingActions.accounts.request, {
    items: [
      { providerId: 'mock:account', name: 'mock-account', iban: null, currency: 'EUR' as const },
    ],
    nextCursor: null,
  }),
  transactions: mock(BankingActions.transactions.request, {
    items: [
      {
        providerId: 'mock:transaction',
        accountId: 'mock:account',
        bookedOn: '2026-01-01',
        amountCents: 12500,
        currency: 'EUR' as const,
        description: 'mock-transaction',
        status: 'booked' as const,
      },
    ],
    nextCursor: null,
  }),
  verifyWebhook: mock(BankingActions.verifyWebhook.request, webhook),
};
export const ElectronicInvoiceMockActions = {
  get: mock(ElectronicInvoiceActions.get.request, invoice),
  cancel: mock(ElectronicInvoiceActions.cancel.request, {
    ...invoice,
    status: 'cancelled' as const,
  }),
  download: mock(ElectronicInvoiceActions.download.request, file),
  inbox: mock(ElectronicInvoiceActions.inbox.request, {
    items: [{ ...invoice, direction: 'incoming' as const }],
    nextCursor: null,
  }),
  report: mock(ElectronicInvoiceActions.report.request, report),
  getReport: mock(ElectronicInvoiceActions.getReport.request, report),
  events: mock(ElectronicInvoiceActions.events.request, events),
  verifyWebhook: mock(ElectronicInvoiceActions.verifyWebhook.request, webhook),
};
