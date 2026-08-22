import {
  type DocumentParty,
  type InvoiceRenderSnapshotValue,
  type IssuerSettings,
  type OrderRenderSnapshotValue,
  type QuoteRenderSnapshotValue,
} from '@froment/contracts';
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
  lines: Schema.Array(DocumentLine),
  totals: Schema.Array(TextPair),
  termsHeading: Schema.String,
  terms: Schema.String,
  legal: Schema.Array(Schema.String),
  footer: Schema.String,
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
    issuer.registrationNumber.length === 0 ? '' : `SIRET : ${issuer.registrationNumber}`,
    issuer.vatNumber.length === 0 ? '' : `TVA intracom. : ${issuer.vatNumber}`,
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
  ['Total HT', money(snapshot.netTotalCents)],
  ['TVA', money(snapshot.vatTotalCents)],
  ['Total TTC', money(snapshot.totalCents)],
];

export const prepareQuoteDocument = (snapshot: QuoteRenderSnapshotValue): QuoteDocumentInput =>
  Schema.decodeUnknownSync(QuoteDocumentInput)({
    issuer: issuerLines(snapshot.issuer),
    clientHeading: 'Proposé à :',
    client: partyLines(snapshot.client),
    metadata: [
      ['Devis n° :', snapshot.quoteReference],
      ['Date d’émission :', date(snapshot.createdAt)],
      ['Révision :', String(snapshot.version)],
      ['Devise :', snapshot.currency],
    ],
    context: [],
    title: wrapText(snapshot.title),
    lines: lines(snapshot.lines),
    totals: totals(snapshot),
    termsHeading: snapshot.conditions.length === 0 ? '' : 'Conditions :',
    terms: wrapText(snapshot.conditions),
    legal: [],
    footer: snapshot.issuer.displayName,
  });

export const prepareInvoiceDocument = (
  snapshot: InvoiceRenderSnapshotValue,
): InvoiceDocumentInput =>
  Schema.decodeUnknownSync(InvoiceDocumentInput)({
    issuer: issuerLines(snapshot.issuer),
    clientHeading: 'Facturé à :',
    client: partyLines(snapshot.client),
    metadata: [
      ['Facture n° :', snapshot.invoiceNumber ?? 'Brouillon'],
      ...(snapshot.issuedAt === null
        ? []
        : ([['Date d’émission :', date(snapshot.issuedAt)]] as const)),
      ['Date d’échéance :', date(snapshot.dueDate)],
      ['Devise :', snapshot.currency],
    ],
    context: [
      `Commande n° : ${snapshot.orderReference}`,
      `Devis n° : ${snapshot.quoteReference}`,
      `Date de prestation : ${date(snapshot.serviceDate)}`,
    ],
    title: wrapText(snapshot.title),
    lines: lines(snapshot.lines),
    totals: totals(snapshot),
    termsHeading: snapshot.paymentTerms.length === 0 ? '' : 'Conditions de règlement :',
    terms: wrapText(snapshot.paymentTerms),
    legal: [
      'En cas de retard de paiement, des pénalités sont exigibles au taux prévu par l’article L441-10 du Code de commerce.',
      'Indemnité forfaitaire pour frais de recouvrement : 40 €.',
    ],
    footer: snapshot.issuer.displayName,
  });

export const prepareOrderDocument = (snapshot: OrderRenderSnapshotValue): OrderDocumentInput =>
  Schema.decodeUnknownSync(OrderDocumentInput)({
    issuer: issuerLines(snapshot.issuer),
    clientHeading: 'Commandé par :',
    client: partyLines(snapshot.client),
    metadata: [
      ['Commande n° :', snapshot.orderReference],
      ['Devis n° :', snapshot.quoteReference],
      ['Date de confirmation :', date(snapshot.confirmedAt)],
      ['Devise :', snapshot.currency],
    ],
    context: [],
    title: wrapText(`Confirmation de commande · ${snapshot.title}`),
    lines: lines(snapshot.lines),
    totals: totals(snapshot),
    termsHeading: snapshot.conditions.length === 0 ? '' : 'Conditions :',
    terms: wrapText(snapshot.conditions),
    legal: [],
    footer: snapshot.issuer.displayName,
  });
