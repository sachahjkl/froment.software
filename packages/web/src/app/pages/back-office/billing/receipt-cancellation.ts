import {
  type InvoiceCredits,
  type InvoiceDetailValue,
  type InvoicePaymentValue,
} from '@froment/contracts';
import { activePaidCents } from './billing-state';

export function canCancelPayment(
  invoice: InvoiceDetailValue | undefined,
  payment: InvoicePaymentValue | undefined,
  credits: typeof InvoiceCredits.Type | undefined,
): boolean {
  if (
    !invoice ||
    !payment ||
    !credits ||
    payment.cancelledAt !== null ||
    (invoice.status !== 'issued' && invoice.status !== 'paid')
  )
    return false;
  const refunded = credits.refunds.reduce(
    (sum, refund) => sum + (refund.cancelledAt === null ? refund.amountCents : 0),
    0,
  );
  return activePaidCents(invoice) - payment.amountCents >= refunded;
}
