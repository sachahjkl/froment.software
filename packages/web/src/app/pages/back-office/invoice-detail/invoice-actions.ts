import { type InvoiceDetailValue } from '@froment/contracts';
import { type TranslationKey } from '@app/i18n.service';
import { detailBalance } from '../billing/billing-state';

interface InvoiceActions {
  readonly edit: boolean;
  readonly recordPayment: boolean;
  readonly credit: boolean;
  readonly void: boolean;
}

export function invoiceActions(invoice: InvoiceDetailValue | undefined): InvoiceActions {
  if (!invoice) return { edit: false, recordPayment: false, credit: false, void: false };
  const issued = invoice.status === 'issued';
  const balance = detailBalance(invoice);
  return {
    edit: invoice.status === 'draft',
    recordPayment: issued && balance > 0,
    credit:
      (issued || invoice.status === 'paid') &&
      invoice.creditedCents < invoice.currentRevision.totalCents,
    void: issued && invoice.creditedCents === 0 && invoice.payments.length === 0,
  };
}

export function recordedEntryStatus(cancelledAt: string | null): TranslationKey {
  return cancelledAt === null ? 'billingWorkspace.active' : 'billingWorkspace.cancelled';
}
