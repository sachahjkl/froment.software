import {
  type DocumentParty,
  type InvoiceRenderSnapshotValue,
  type IssuerSettings,
  type OrderRenderSnapshotValue,
  type QuoteRenderSnapshotValue,
} from '@froment/contracts';
import { documentText } from '@froment/l10n';
import { Schema } from 'effect';

import { formatMoney } from './format-money.js';

const TextPair = Schema.Tuple([Schema.String, Schema.String]);
const DocumentLine = Schema.Struct({
  position: Schema.String,
  description: Schema.String,
  unitPrice: Schema.String,
  quantity: Schema.String,
  vat: Schema.String,
  amount: Schema.String,
});
const PreparedDocument = Schema.Struct({
  issuer: Schema.Array(Schema.String),
  clientHeading: Schema.String,
  client: Schema.Array(Schema.String),
  metadata: Schema.Array(TextPair),
  context: Schema.Array(Schema.String),
  title: Schema.String,
  lineHeadings: Schema.Tuple([
    Schema.String,
    Schema.String,
    Schema.String,
    Schema.String,
    Schema.String,
    Schema.String,
  ]),
  lines: Schema.Array(DocumentLine),
  totals: Schema.Array(TextPair),
  termsHeading: Schema.String,
  terms: Schema.String,
  legal: Schema.Array(Schema.String),
  footer: Schema.String,
  thankYou: Schema.String,
});

export const QuoteDocumentInput = PreparedDocument.annotate({ identifier: 'QuoteDocumentInput' });
export type QuoteDocumentInput = typeof QuoteDocumentInput.Type;
export const InvoiceDocumentInput = PreparedDocument.annotate({
  identifier: 'InvoiceDocumentInput',
});
export type InvoiceDocumentInput = typeof InvoiceDocumentInput.Type;
export const OrderDocumentInput = PreparedDocument.annotate({ identifier: 'OrderDocumentInput' });
export type OrderDocumentInput = typeof OrderDocumentInput.Type;

const nonEmpty = (values: ReadonlyArray<string>): Array<string> =>
  values.filter((value) => value.length > 0);
const wrapText = (value: string): string => value.replaceAll(/(\S{18})(?=\S)/g, '$1\u200b');

const partyLines = (party: DocumentParty): Array<string> =>
  nonEmpty([
    party.displayName,
    party.addressLine1,
    party.addressLine2,
    `${party.postalCode} ${party.city}`.trim(),
    party.country,
    party.email,
  ]).map(wrapText);

const issuerLines = (issuer: IssuerSettings): Array<string> => [
  ...partyLines(issuer),
  ...nonEmpty([
    issuer.phone,
    issuer.registrationNumber.length === 0
      ? ''
      : `${documentText.fr.registrationNumber} ${issuer.registrationNumber}`,
    issuer.vatNumber.length === 0 ? '' : `${documentText.fr.vatNumber} ${issuer.vatNumber}`,
  ]),
];

const money = (cents: number): string => formatMoney(cents, 'fr-FR', 'EUR');
const quantity = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(value / 1_000);
const percent = (value: number): string =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value / 100)} %`;
const date = (value: string): string =>
  new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));

const lines = (source: QuoteRenderSnapshotValue['lines']): Array<typeof DocumentLine.Type> =>
  source.map((line, index) => ({
    position: String(index + 1),
    description: wrapText(line.description),
    unitPrice: money(line.unitPriceCents),
    quantity: quantity(line.quantityMilli),
    vat: percent(line.vatRateBasisPoints),
    amount: money(line.netTotalCents),
  }));

const totals = (snapshot: {
  readonly netTotalCents: number;
  readonly vatTotalCents: number;
  readonly totalCents: number;
}): Array<readonly [string, string]> => [
  [documentText.fr.netTotal, money(snapshot.netTotalCents)],
  [documentText.fr.vatTotal, money(snapshot.vatTotalCents)],
  [documentText.fr.total, money(snapshot.totalCents)],
];

const lineHeadings = [
  documentText.fr.lineNumber,
  documentText.fr.lineDescription,
  documentText.fr.lineUnitPrice,
  documentText.fr.lineQuantity,
  documentText.fr.lineVat,
  documentText.fr.lineAmount,
] as const;

export const prepareQuoteDocument = (snapshot: QuoteRenderSnapshotValue): QuoteDocumentInput =>
  Schema.decodeUnknownSync(QuoteDocumentInput)({
    issuer: issuerLines(snapshot.issuer),
    clientHeading: documentText.fr.proposedTo,
    client: partyLines(snapshot.client),
    metadata: [
      [documentText.fr.quoteNumber, snapshot.quoteReference],
      [documentText.fr.issueDate, date(snapshot.createdAt)],
      [documentText.fr.revision, String(snapshot.version)],
      [documentText.fr.currency, snapshot.currency],
    ],
    context: [],
    title: wrapText(snapshot.title),
    lineHeadings,
    lines: lines(snapshot.lines),
    totals: totals(snapshot),
    termsHeading: snapshot.conditions.length === 0 ? '' : documentText.fr.conditions,
    terms: wrapText(snapshot.conditions),
    legal: [],
    footer: snapshot.issuer.displayName,
    thankYou: documentText.fr.thankYou,
  });

export const prepareInvoiceDocument = (
  snapshot: InvoiceRenderSnapshotValue,
): InvoiceDocumentInput =>
  Schema.decodeUnknownSync(InvoiceDocumentInput)({
    issuer: issuerLines(snapshot.issuer),
    clientHeading: documentText.fr.billedTo,
    client: partyLines(snapshot.client),
    metadata: [
      [documentText.fr.invoiceNumber, snapshot.invoiceNumber ?? documentText.fr.draft],
      ...(snapshot.issuedAt === null
        ? []
        : ([[documentText.fr.issueDate, date(snapshot.issuedAt)]] as const)),
      [documentText.fr.dueDate, date(snapshot.dueDate)],
      [documentText.fr.currency, snapshot.currency],
    ],
    context: [
      `${documentText.fr.orderNumber} ${snapshot.orderReference}`,
      `${documentText.fr.quoteNumber} ${snapshot.quoteReference}`,
      `${documentText.fr.serviceDate} ${date(snapshot.serviceDate)}`,
    ],
    title: wrapText(snapshot.title),
    lineHeadings,
    lines: lines(snapshot.lines),
    totals: totals(snapshot),
    termsHeading: snapshot.paymentTerms.length === 0 ? '' : documentText.fr.paymentTerms,
    terms: wrapText(snapshot.paymentTerms),
    legal: [documentText.fr.latePayment, documentText.fr.collectionFee],
    footer: snapshot.issuer.displayName,
    thankYou: documentText.fr.thankYou,
  });

export const prepareOrderDocument = (snapshot: OrderRenderSnapshotValue): OrderDocumentInput =>
  Schema.decodeUnknownSync(OrderDocumentInput)({
    issuer: issuerLines(snapshot.issuer),
    clientHeading: documentText.fr.orderedBy,
    client: partyLines(snapshot.client),
    metadata: [
      [documentText.fr.orderNumber, snapshot.orderReference],
      [documentText.fr.quoteNumber, snapshot.quoteReference],
      [documentText.fr.confirmationDate, date(snapshot.confirmedAt)],
      [documentText.fr.currency, snapshot.currency],
    ],
    context: [],
    title: wrapText(`${documentText.fr.orderConfirmation} · ${snapshot.title}`),
    lineHeadings,
    lines: lines(snapshot.lines),
    totals: totals(snapshot),
    termsHeading: snapshot.conditions.length === 0 ? '' : documentText.fr.conditions,
    terms: wrapText(snapshot.conditions),
    legal: [],
    footer: snapshot.issuer.displayName,
    thankYou: documentText.fr.thankYou,
  });
