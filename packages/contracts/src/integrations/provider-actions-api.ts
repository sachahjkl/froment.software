import { Schema } from 'effect';
import { HttpApiEndpoint, HttpApiGroup } from 'effect/unstable/httpapi';
import { ApiBrowserRequest, ApiRequestBody } from '../api-authentication.js';
import { authenticate } from '../api-policy/authentication.js';
import { requirePermissions } from '../api-policy/permissions.js';
import { frontendSpecific } from '../api-policy/visibility.js';
import { rateLimit, RateLimits } from '../api-policy/rate-limit.js';
import { Permissions } from '../permissions.js';
import { ProviderActionFailure } from './provider-actions.js';
import {
  EmailActions,
  SignatureActions,
  PaymentActions,
  BankingActions,
  ElectronicInvoiceActions,
} from './provider-actions.js';

const endpoint = <const Name extends string, I extends Schema.Top, O extends Schema.Top>(
  name: Name,
  path: `/${string}`,
  contract: { request: I; response: O },
) =>
  HttpApiEndpoint.post(name, path, {
    payload: contract.request,
    success: contract.response,
    error: ProviderActionFailure.members,
  })
    .middleware(ApiRequestBody)
    .middleware(ApiBrowserRequest)
    .pipe(
      requirePermissions([Permissions.integrationManage]),
      authenticate,
      rateLimit(RateLimits.sixtyPerMinute),
      frontendSpecific,
    );

export class ProviderActionsApi extends HttpApiGroup.make('providerActions', {
  topLevel: true,
}).add(
  endpoint('providerEmailGet', '/api/providers/email/get', EmailActions.get),
  endpoint('providerEmailCancel', '/api/providers/email/cancel', EmailActions.cancel),
  endpoint('providerEmailEvents', '/api/providers/email/events', EmailActions.events),
  endpoint(
    'providerEmailVerifyWebhook',
    '/api/providers/email/verify-webhook',
    EmailActions.verifyWebhook,
  ),
  endpoint('providerSignatureGet', '/api/providers/signature/get', SignatureActions.get),
  endpoint('providerSignatureCancel', '/api/providers/signature/cancel', SignatureActions.cancel),
  endpoint('providerSignatureRemind', '/api/providers/signature/remind', SignatureActions.remind),
  endpoint(
    'providerSignatureDocument',
    '/api/providers/signature/document',
    SignatureActions.signedDocument,
  ),
  endpoint('providerSignatureProof', '/api/providers/signature/proof', SignatureActions.proof),
  endpoint('providerSignatureEvents', '/api/providers/signature/events', SignatureActions.events),
  endpoint(
    'providerSignatureVerifyWebhook',
    '/api/providers/signature/verify-webhook',
    SignatureActions.verifyWebhook,
  ),
  endpoint('providerPaymentGet', '/api/providers/payment/get', PaymentActions.get),
  endpoint('providerPaymentCancel', '/api/providers/payment/cancel', PaymentActions.cancel),
  endpoint('providerPaymentCapture', '/api/providers/payment/capture', PaymentActions.capture),
  endpoint('providerPaymentRefund', '/api/providers/payment/refund', PaymentActions.refund),
  endpoint(
    'providerPaymentGetRefund',
    '/api/providers/payment/get-refund',
    PaymentActions.getRefund,
  ),
  endpoint('providerPaymentEvents', '/api/providers/payment/events', PaymentActions.events),
  endpoint(
    'providerPaymentVerifyWebhook',
    '/api/providers/payment/verify-webhook',
    PaymentActions.verifyWebhook,
  ),
  endpoint('providerBankConnect', '/api/providers/banking/connect', BankingActions.connect),
  endpoint(
    'providerBankConnection',
    '/api/providers/banking/connection',
    BankingActions.getConnection,
  ),
  endpoint('providerBankRevoke', '/api/providers/banking/revoke', BankingActions.revokeConnection),
  endpoint('providerBankAccounts', '/api/providers/banking/accounts', BankingActions.accounts),
  endpoint(
    'providerBankTransactions',
    '/api/providers/banking/transactions',
    BankingActions.transactions,
  ),
  endpoint(
    'providerBankVerifyWebhook',
    '/api/providers/banking/verify-webhook',
    BankingActions.verifyWebhook,
  ),
  endpoint(
    'providerElectronicInvoiceGet',
    '/api/providers/electronic-invoice/get',
    ElectronicInvoiceActions.get,
  ),
  endpoint(
    'providerElectronicInvoiceCancel',
    '/api/providers/electronic-invoice/cancel',
    ElectronicInvoiceActions.cancel,
  ),
  endpoint(
    'providerElectronicInvoiceDownload',
    '/api/providers/electronic-invoice/download',
    ElectronicInvoiceActions.download,
  ),
  endpoint(
    'providerElectronicInvoiceInbox',
    '/api/providers/electronic-invoice/inbox',
    ElectronicInvoiceActions.inbox,
  ),
  endpoint(
    'providerElectronicInvoiceReport',
    '/api/providers/electronic-invoice/report',
    ElectronicInvoiceActions.report,
  ),
  endpoint(
    'providerElectronicInvoiceGetReport',
    '/api/providers/electronic-invoice/get-report',
    ElectronicInvoiceActions.getReport,
  ),
  endpoint(
    'providerElectronicInvoiceEvents',
    '/api/providers/electronic-invoice/events',
    ElectronicInvoiceActions.events,
  ),
  endpoint(
    'providerElectronicInvoiceVerifyWebhook',
    '/api/providers/electronic-invoice/verify-webhook',
    ElectronicInvoiceActions.verifyWebhook,
  ),
) {}
