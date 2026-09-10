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
  const noCredit = invoice.creditedCents === 0;
  return {
    edit: invoice.status === 'draft',
    recordPayment: issued && noCredit && detailBalance(invoice) > 0,
    credit:
      (issued || invoice.status === 'paid') && noCredit && invoice.currentRevision.totalCents > 0,
    void: issued && noCredit && invoice.payments.length === 0,
  };
}

export function recordedEntryStatus(cancelledAt: string | null): TranslationKey {
  return cancelledAt === null ? 'billingWorkspace.active' : 'billingWorkspace.cancelled';
}
