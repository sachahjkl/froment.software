import { convertToParamMap } from '@angular/router';
import { affairContext } from '../affairs/affair-filters';
import { invoiceFixture, paymentFixture } from '../billing/billing.spec-helper';
import { orderFixture, quoteFixture } from '../quote-detail/commercial.spec-helper';
import { affairDocuments, invoiceReference } from './affair-documents';

describe('Affair documents', () => {
  const context = affairContext(
    convertToParamMap({ q: 'Audit', view: 'active', sort: 'updated-asc', ignored: 'value' }),
  );

  it('omits documents that do not exist', () => {
    const documents = affairDocuments(quoteFixture, undefined, undefined, context, 'fr');
    expect(documents.map((document) => document.kind)).toEqual(['quote']);
    expect(documents[0]).toMatchObject({
      reference: quoteFixture.reference,
      date: quoteFixture.currentRevision.createdAt,
      totalCents: quoteFixture.currentRevision.totalCents,
      link: ['/backoffice/quotes', quoteFixture.id],
      query: context,
    });
  });

  it('uses each document amount and date without substituting the quote values', () => {
    const order = { ...orderFixture, totalCents: 2400, createdAt: '2026-08-21T10:00:00.000Z' };
    const invoice = invoiceFixture();
    const documents = affairDocuments(
      quoteFixture,
      order,
      {
        ...invoice,
        issuedAt: '2026-08-22T10:00:00.000Z',
        currentRevision: { ...invoice.currentRevision, totalCents: 3600 },
      },
      context,
      'fr',
    );
    expect(documents.map(({ kind, totalCents, date }) => ({ kind, totalCents, date }))).toEqual([
      { kind: 'quote', totalCents: 1200, date: quoteFixture.currentRevision.createdAt },
      { kind: 'order', totalCents: 2400, date: order.createdAt },
      { kind: 'invoice', totalCents: 3600, date: '2026-08-22T10:00:00.000Z' },
    ]);
    expect(documents[1]?.query).toEqual(context);
    expect(documents[2]?.query).toBeUndefined();
    expect(documents[1]?.query).not.toHaveProperty('ignored');
  });

  it('labels an unnumbered invoice without reusing the order reference', () => {
    expect(invoiceReference(null, 'fr')).toBe('Facture brouillon');
    expect(invoiceReference(null, 'en')).toBe('Draft invoice');
    expect(invoiceReference('FA-2026-000042', 'fr')).toBe('FA-2026-000042');
    const invoice = invoiceFixture('draft');
    const document = affairDocuments(quoteFixture, orderFixture, invoice, context, 'fr').find(
      (document) => document.kind === 'invoice',
    );
    expect(document).toMatchObject({
      reference: 'Facture brouillon',
      date: invoice.currentRevision.createdAt,
      dateLabel: 'billingWorkspace.revised',
      badges: [{ label: 'backOffice.invoice.status.draft', variant: 'default' }],
    });
    expect(document?.reference).not.toBe(invoice.orderReference);
  });

  it('keeps invoice status separate from active payments and credits', () => {
    const invoice = { ...invoiceFixture(), payments: [paymentFixture()] };
    const document = affairDocuments(quoteFixture, orderFixture, invoice, context, 'en').find(
      (document) => document.kind === 'invoice',
    );
    expect(document?.badges).toEqual([
      { label: 'backOffice.invoice.status.issued', variant: 'success' },
      { label: 'billingWorkspace.partial', variant: 'warning' },
    ]);
  });

  it('does not repeat the payment status as the document status', () => {
    const invoice = {
      ...invoiceFixture('paid'),
      payments: [{ ...paymentFixture(), amountCents: 1200 }],
    };
    const document = affairDocuments(quoteFixture, orderFixture, invoice, context, 'fr').find(
      (document) => document.kind === 'invoice',
    );
    expect(document?.badges).toEqual([
      { label: 'backOffice.invoice.status.issued', variant: 'success' },
      { label: 'billingWorkspace.paid', variant: 'success' },
    ]);
  });
});
