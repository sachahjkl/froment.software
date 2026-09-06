import {
  BankingSubmission,
  ElectronicInvoiceSubmission,
  EmailSubmission,
  IntegrationUnavailable,
  PaymentSubmission,
  SignatureSubmission,
  type ProviderReceiptValue,
} from '@froment/contracts';
import { Context, Effect, Layer } from 'effect';

interface Provider<Request> {
  readonly mode: 'simulation' | 'live';
  readonly submit: (
    request: Request,
  ) => Effect.Effect<ProviderReceiptValue, IntegrationUnavailable>;
}
export class EmailProvider extends Context.Service<
  EmailProvider,
  Provider<typeof EmailSubmission.Type>
>()('@froment/api/EmailProvider') {}
export class SignatureProvider extends Context.Service<
  SignatureProvider,
  Provider<typeof SignatureSubmission.Type>
>()('@froment/api/SignatureProvider') {}
export class PaymentProvider extends Context.Service<
  PaymentProvider,
  Provider<typeof PaymentSubmission.Type>
>()('@froment/api/PaymentProvider') {}
export class BankingProvider extends Context.Service<
  BankingProvider,
  Provider<typeof BankingSubmission.Type>
>()('@froment/api/BankingProvider') {}
export class ElectronicInvoiceProvider extends Context.Service<
  ElectronicInvoiceProvider,
  Provider<typeof ElectronicInvoiceSubmission.Type>
>()('@froment/api/ElectronicInvoiceProvider') {}

const simulate = Effect.fn('Provider.simulate')(
  (request: { readonly kind: string; readonly requestId: string }) =>
    Effect.succeed<ProviderReceiptValue>({
      id: `simulation:${request.kind}:${request.requestId}`,
      mode: 'simulation',
      status: 'simulated',
    }),
);
export const SimulatedProviders = Layer.mergeAll(
  Layer.succeed(EmailProvider, EmailProvider.of({ mode: 'simulation', submit: simulate })),
  Layer.succeed(SignatureProvider, SignatureProvider.of({ mode: 'simulation', submit: simulate })),
  Layer.succeed(PaymentProvider, PaymentProvider.of({ mode: 'simulation', submit: simulate })),
  Layer.succeed(BankingProvider, BankingProvider.of({ mode: 'simulation', submit: simulate })),
  Layer.succeed(
    ElectronicInvoiceProvider,
    ElectronicInvoiceProvider.of({ mode: 'simulation', submit: simulate }),
  ),
);
