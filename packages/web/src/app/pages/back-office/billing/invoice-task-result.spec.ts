import { describe, expect, it } from 'vitest';
import { invoiceFailureResolution, type InvoiceTaskOperation } from './invoice-task-result';

const operations: ReadonlyArray<InvoiceTaskOperation> = [
  'issue',
  'void',
  'record-payment',
  'cancel-payment',
  'issue-credit',
  'refund',
  'cancel-refund',
];

describe('invoice failure resolution', () => {
  it.each([
    'authentication.required',
    'authentication.permission_denied',
    'request.rate_limited',
    'request.invalid_origin',
    'request.too_large',
  ])('does not resolve earlier attempts from the boundary refusal %s', (code) => {
    for (const operation of operations) {
      expect(invoiceFailureResolution(operation, code)).toBe('attempt-rejected');
    }
  });

  it.each([
    undefined,
    'invoice.error',
    'credit.error',
    'request.new_boundary_failure',
    'invoice.new_business_failure',
  ])('keeps unclassified result %s unknown for every operation', (code) => {
    for (const operation of operations) {
      expect(invoiceFailureResolution(operation, code)).toBe('unknown');
    }
  });

  it('resolves credit refusals after absence but not conflicts with an existing request', () => {
    for (const operation of ['refund', 'issue-credit', 'cancel-refund'] as const) {
      expect(invoiceFailureResolution(operation, 'invoice.credit_conflict')).toBe(
        'request-rejected',
      );
      expect(invoiceFailureResolution(operation, 'invoice.credit_request_conflict')).toBe(
        'attempt-rejected',
      );
    }
  });

  it('distinguishes a payment replay lookup from a cancellation version check', () => {
    expect(invoiceFailureResolution('record-payment', 'invoice.version_conflict')).toBe(
      'request-rejected',
    );
    expect(invoiceFailureResolution('cancel-payment', 'invoice.version_conflict')).toBe(
      'attempt-rejected',
    );
    expect(invoiceFailureResolution('issue', 'invoice.version_conflict')).toBe('attempt-rejected');
    expect(invoiceFailureResolution('void', 'invoice.version_conflict')).toBe('attempt-rejected');
  });

  it('does not treat validation before replay lookup as proof about an earlier payment', () => {
    expect(invoiceFailureResolution('record-payment', 'invoice.payment_invalid')).toBe(
      'attempt-rejected',
    );
    expect(invoiceFailureResolution('cancel-payment', 'invoice.payment_invalid')).toBe(
      'attempt-rejected',
    );
  });

  it('resolves issue validation only when the server has already checked the transition', () => {
    expect(invoiceFailureResolution('issue', 'document.incomplete')).toBe('request-rejected');
    expect(invoiceFailureResolution('issue', 'invoice.invalid_dates')).toBe('request-rejected');
    expect(invoiceFailureResolution('issue', 'invoice.invalid_transition')).toBe(
      'attempt-rejected',
    );
  });
});
