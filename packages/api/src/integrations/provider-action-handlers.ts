import { Api } from '@froment/contracts';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/unstable/httpapi';
import { setPrivateResponseHeaders } from '../http/response.js';
import {
  EmailProvider,
  SignatureProvider,
  PaymentProvider,
  BankingProvider,
  ElectronicInvoiceProvider,
} from './providers.js';

const respond = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.andThen(setPrivateResponseHeaders, effect);

export const ProviderActionHandlers = HttpApiBuilder.group(Api, 'providerActions', (handlers) =>
  handlers
    .handle('providerEmailGet', ({ payload }) =>
      respond(EmailProvider.use((provider) => provider.get(payload))),
    )
    .handle('providerEmailCancel', ({ payload }) =>
      respond(EmailProvider.use((provider) => provider.cancel(payload))),
    )
    .handle('providerEmailEvents', ({ payload }) =>
      respond(EmailProvider.use((provider) => provider.events(payload))),
    )
    .handle('providerEmailVerifyWebhook', ({ payload }) =>
      respond(EmailProvider.use((provider) => provider.verifyWebhook(payload))),
    )
    .handle('providerSignatureGet', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.get(payload))),
    )
    .handle('providerSignatureCancel', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.cancel(payload))),
    )
    .handle('providerSignatureRemind', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.remind(payload))),
    )
    .handle('providerSignatureDocument', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.signedDocument(payload))),
    )
    .handle('providerSignatureProof', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.proof(payload))),
    )
    .handle('providerSignatureEvents', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.events(payload))),
    )
    .handle('providerSignatureVerifyWebhook', ({ payload }) =>
      respond(SignatureProvider.use((provider) => provider.verifyWebhook(payload))),
    )
    .handle('providerPaymentGet', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.get(payload))),
    )
    .handle('providerPaymentCancel', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.cancel(payload))),
    )
    .handle('providerPaymentCapture', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.capture(payload))),
    )
    .handle('providerPaymentRefund', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.refund(payload))),
    )
    .handle('providerPaymentGetRefund', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.getRefund(payload))),
    )
    .handle('providerPaymentEvents', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.events(payload))),
    )
    .handle('providerPaymentVerifyWebhook', ({ payload }) =>
      respond(PaymentProvider.use((provider) => provider.verifyWebhook(payload))),
    )
    .handle('providerBankConnect', ({ payload }) =>
      respond(BankingProvider.use((provider) => provider.connect(payload))),
    )
    .handle('providerBankConnection', ({ payload }) =>
      respond(BankingProvider.use((provider) => provider.getConnection(payload))),
    )
    .handle('providerBankRevoke', ({ payload }) =>
      respond(BankingProvider.use((provider) => provider.revokeConnection(payload))),
    )
    .handle('providerBankAccounts', ({ payload }) =>
      respond(BankingProvider.use((provider) => provider.accounts(payload))),
    )
    .handle('providerBankTransactions', ({ payload }) =>
      respond(BankingProvider.use((provider) => provider.transactions(payload))),
    )
    .handle('providerBankVerifyWebhook', ({ payload }) =>
      respond(BankingProvider.use((provider) => provider.verifyWebhook(payload))),
    )
    .handle('providerElectronicInvoiceGet', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.get(payload))),
    )
    .handle('providerElectronicInvoiceCancel', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.cancel(payload))),
    )
    .handle('providerElectronicInvoiceDownload', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.download(payload))),
    )
    .handle('providerElectronicInvoiceInbox', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.inbox(payload))),
    )
    .handle('providerElectronicInvoiceReport', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.report(payload))),
    )
    .handle('providerElectronicInvoiceGetReport', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.getReport(payload))),
    )
    .handle('providerElectronicInvoiceEvents', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.events(payload))),
    )
    .handle('providerElectronicInvoiceVerifyWebhook', ({ payload }) =>
      respond(ElectronicInvoiceProvider.use((provider) => provider.verifyWebhook(payload))),
    ),
);
