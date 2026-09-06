import {
  BankingSubmission,
  ElectronicInvoiceSubmission,
  EmailSubmission,
  IntegrationUnavailable,
  PaymentSubmission,
  SignatureSubmission,
  type ProviderReceiptValue,
  EmailActions,
  SignatureActions,
  PaymentActions,
  BankingActions,
  ElectronicInvoiceActions,
  ProviderActionError,
} from '@froment/contracts';
import { Context, Effect, Layer, type Schema } from 'effect';
import {
  EmailMockActions,
  SignatureMockActions,
  PaymentMockActions,
  BankingMockActions,
  ElectronicInvoiceMockActions,
} from './provider-mocks.js';

type Actions<
  Contract extends Record<string, { request: Schema.Constraint; response: Schema.Constraint }>,
> = {
  readonly [Name in keyof Contract]: (
    request: Contract[Name]['request']['Type'],
  ) => Effect.Effect<Contract[Name]['response']['Type'], typeof ProviderActionError.Type>;
};

interface Provider<Request> {
  readonly mode: 'simulation' | 'live';
  readonly submit: (
    request: Request,
  ) => Effect.Effect<ProviderReceiptValue, IntegrationUnavailable>;
}
export class EmailProvider extends Context.Service<
  EmailProvider,
  Provider<typeof EmailSubmission.Type> & Actions<typeof EmailActions>
>()('@froment/api/EmailProvider') {}
export class SignatureProvider extends Context.Service<
  SignatureProvider,
  Provider<typeof SignatureSubmission.Type> & Actions<typeof SignatureActions>
>()('@froment/api/SignatureProvider') {}
export class PaymentProvider extends Context.Service<
  PaymentProvider,
  Provider<typeof PaymentSubmission.Type> & Actions<typeof PaymentActions>
>()('@froment/api/PaymentProvider') {}
export class BankingProvider extends Context.Service<
  BankingProvider,
  Provider<typeof BankingSubmission.Type> & Actions<typeof BankingActions>
>()('@froment/api/BankingProvider') {}
export class ElectronicInvoiceProvider extends Context.Service<
  ElectronicInvoiceProvider,
  Provider<typeof ElectronicInvoiceSubmission.Type> & Actions<typeof ElectronicInvoiceActions>
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
  Layer.succeed(
    EmailProvider,
    EmailProvider.of({ mode: 'simulation', submit: simulate, ...EmailMockActions }),
  ),
  Layer.succeed(
    SignatureProvider,
    SignatureProvider.of({ mode: 'simulation', submit: simulate, ...SignatureMockActions }),
  ),
  Layer.succeed(
    PaymentProvider,
    PaymentProvider.of({ mode: 'simulation', submit: simulate, ...PaymentMockActions }),
  ),
  Layer.succeed(
    BankingProvider,
    BankingProvider.of({ mode: 'simulation', submit: simulate, ...BankingMockActions }),
  ),
  Layer.succeed(
    ElectronicInvoiceProvider,
    ElectronicInvoiceProvider.of({
      mode: 'simulation',
      submit: simulate,
      ...ElectronicInvoiceMockActions,
    }),
  ),
);
