import { type InvoiceStatusValue, type QuoteStatusValue } from '@froment/contracts';
import { type BadgeVariant } from '@shared/badge/badge';
import { invoiceFixture, paymentFixture } from './billing/billing.spec-helper';
import {
  commercialDocumentTitle,
  invoiceFinancialBadge,
  invoiceStatusBadge,
  quoteStatusBadge,
} from './commercial-header';

describe('Commercial document headings', () => {
  it('keeps the reference and title without inventing a draft reference', () => {
    expect(commercialDocumentTitle('FA-2026-000001', 'Audit')).toBe('FA-2026-000001 · Audit');
    expect(commercialDocumentTitle(null, 'Audit')).toBe('Audit');
  });

  it.each<[QuoteStatusValue, BadgeVariant]>([
    ['draft', 'default'],
    ['sent', 'warning'],
    ['accepted', 'success'],
    ['rejected', 'danger'],
    ['expired', 'warning'],
    ['cancelled', 'danger'],
  ])('maps quote status %s to its label and color', (status, variant) => {
    expect(quoteStatusBadge(status)).toEqual({
      label: `backOffice.quote.status.${status}`,
      variant,
    });
  });

  it.each<[InvoiceStatusValue, string, BadgeVariant]>([
    ['draft', 'draft', 'default'],
    ['issued', 'issued', 'success'],
    ['paid', 'issued', 'success'],
    ['void', 'void', 'danger'],
  ])('keeps invoice document status %s separate from payment status', (status, label, variant) => {
    expect(invoiceStatusBadge(status)).toEqual({
      label: `backOffice.invoice.status.${label}`,
      variant,
    });
  });

  it.each<InvoiceStatusValue>(['draft', 'void'])('has no financial state for %s', (status) => {
    expect(invoiceFinancialBadge(invoiceFixture(status))).toEqual({
      label: 'billingWorkspace.notApplicable',
      variant: 'default',
    });
  });

  it('derives the financial badge from active receipts and recorded credits', () => {
    const invoice = invoiceFixture();
    expect(invoiceFinancialBadge(invoice)).toEqual({
      label: 'billingWorkspace.unpaid',
      variant: 'warning',
    });
    expect(invoiceFinancialBadge({ ...invoice, payments: [paymentFixture()] })).toEqual({
      label: 'billingWorkspace.partial',
      variant: 'warning',
    });
    expect(
      invoiceFinancialBadge({ ...invoice, payments: [{ ...paymentFixture(), amountCents: 1200 }] }),
    ).toEqual({
      label: 'billingWorkspace.paid',
      variant: 'success',
    });
    expect(invoiceFinancialBadge({ ...invoice, creditedCents: 1200 })).toEqual({
      label: 'billingWorkspace.credited',
      variant: 'success',
    });
    expect(
      invoiceFinancialBadge({
        ...invoice,
        payments: [{ ...paymentFixture(), cancelledAt: '2026-08-22T06:00:00.000Z' }],
      }),
    ).toEqual({ label: 'billingWorkspace.unpaid', variant: 'warning' });
  });
});
