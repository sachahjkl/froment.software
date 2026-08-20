import { Schema } from 'effect';

export const QuoteReference = Schema.String.check(Schema.isPattern(/^DE-[0-9]{4}-[0-9]{6}$/));
export type QuoteReference = typeof QuoteReference.Type;

export const OrderReference = Schema.String.check(Schema.isPattern(/^CO-[0-9]{4}-[0-9]{6}$/));
export type OrderReference = typeof OrderReference.Type;

export const InvoiceNumber = Schema.String.check(Schema.isPattern(/^FA-[0-9]{4}-[0-9]{6}$/));
export type InvoiceNumber = typeof InvoiceNumber.Type;

export const StoredInvoiceNumber = Schema.Union([
  InvoiceNumber,
  Schema.String.check(Schema.isPattern(/^F-[0-9]{6,}$/)),
]);
export type StoredInvoiceNumber = typeof StoredInvoiceNumber.Type;
