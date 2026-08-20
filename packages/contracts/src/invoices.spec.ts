import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';

import {
  CalendarDate,
  InvoiceCreateRequest,
  InvoiceDocumentArtifact,
  InvoiceIssueRequest,
  InvoiceNumber,
  InvoiceRevisionCreateRequest,
  InvoiceRevision,
  InvoiceRenderSnapshot,
  InvoiceStatus,
  InvoiceSummary,
  InvoiceTransitionRequest,
} from './invoices.js';

describe('invoice contracts', () => {
  it('defines the complete invoice state cycle and number format', () => {
    for (const status of ['draft', 'issued', 'paid', 'void']) {
      expect(Schema.decodeUnknownSync(InvoiceStatus)(status)).toBe(status);
    }
    expect(Schema.decodeUnknownSync(InvoiceNumber)('FA-2026-000001')).toBe('FA-2026-000001');
    expect(() => Schema.decodeUnknownSync(InvoiceNumber)('2026-1')).toThrow();
  });

  it('validates creation, revision, and issue requests', () => {
    const create = {
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      serviceDate: '2026-08-20',
      dueDate: '2026-09-19',
      paymentTerms: 'Payment due in 30 days.',
    };
    expect(Schema.decodeUnknownSync(InvoiceCreateRequest)(create)).toEqual(create);
    expect(() =>
      Schema.decodeUnknownSync(InvoiceCreateRequest)({ ...create, dueDate: '19/09/2026' }),
    ).toThrow();
    for (const invalidDate of ['2026-02-30', '2026-13-01', '2026-01-00']) {
      expect(() => Schema.decodeUnknownSync(CalendarDate)(invalidDate)).toThrow();
      expect(() =>
        Schema.decodeUnknownSync(InvoiceCreateRequest)({ ...create, serviceDate: invalidDate }),
      ).toThrow();
    }
    expect(Schema.decodeUnknownSync(CalendarDate)('2024-02-29')).toBe('2024-02-29');
    expect(Schema.decodeUnknownSync(InvoiceIssueRequest)({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
    expect(() => Schema.decodeUnknownSync(InvoiceIssueRequest)({ expectedVersion: 0 })).toThrow();
    expect(Schema.decodeUnknownSync(InvoiceTransitionRequest)({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    });
    expect(() =>
      Schema.decodeUnknownSync(InvoiceRevisionCreateRequest)({
        expectedVersion: 1,
        title: 'Invoice',
        serviceDate: '2026-08-20',
        dueDate: '2026-09-19',
        paymentTerms: '',
        lines: [],
      }),
    ).toThrow();
    const revisionLine = {
      description: 'Audit',
      quantityMilli: 1_000,
      unitPriceCents: 100,
      vatRateBasisPoints: 2_000,
    };
    expect(
      Schema.decodeUnknownSync(InvoiceRevisionCreateRequest)({
        expectedVersion: 1,
        title: 'Invoice',
        serviceDate: '2026-08-20',
        dueDate: '2026-09-19',
        paymentTerms: '',
        lines: Array.from({ length: 20 }, () => revisionLine),
      }).lines,
    ).toHaveLength(20);
    expect(() =>
      Schema.decodeUnknownSync(InvoiceRevisionCreateRequest)({
        expectedVersion: 1,
        title: 'Invoice',
        serviceDate: '2026-08-20',
        dueDate: '2026-09-19',
        paymentTerms: '',
        lines: Array.from({ length: 21 }, () => revisionLine),
      }),
    ).toThrow();
  });

  it('validates invoice snapshot line and aggregate invariants', () => {
    const party = {
      displayName: 'Client',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
    };
    const snapshot = {
      templateId: 'invoice-default',
      templateVersion: 1,
      invoiceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      orderId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      revisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
      version: 1,
      createdAt: '2026-08-20T08:00:00.000Z',
      invoiceNumber: null,
      issuedAt: null,
      serviceDate: '2026-08-20',
      dueDate: '2026-09-19',
      issuer: { ...party, phone: '', registrationNumber: '', vatNumber: '' },
      client: party,
      title: 'Invoice',
      paymentTerms: '',
      currency: 'EUR',
      netTotalCents: 100,
      vatTotalCents: 20,
      totalCents: 120,
      lines: [
        {
          id: '01ARZ3NDEKTSV4RRFFQ69G5FAY',
          position: 0,
          description: 'Audit',
          quantityMilli: 1_000,
          unitPriceCents: 100,
          vatRateBasisPoints: 2_000,
          netTotalCents: 100,
          vatTotalCents: 20,
          totalCents: 120,
        },
      ],
    };

    expect(Schema.decodeUnknownSync(InvoiceRenderSnapshot)(snapshot)).toEqual(snapshot);
    expect(() =>
      Schema.decodeUnknownSync(InvoiceRenderSnapshot)({ ...snapshot, totalCents: 119 }),
    ).toThrow();
  });

  it('validates invoice PDF metadata', () => {
    const artifact = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      invoiceNumber: 'FA-2026-000001',
      invoiceRevisionId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      kind: 'invoice-pdf',
      contentType: 'application/pdf',
      byteSize: 42,
      sha256: 'a'.repeat(64),
      createdAt: '2026-08-20T20:00:00.000Z',
    };

    expect(Schema.decodeUnknownSync(InvoiceDocumentArtifact)(artifact)).toEqual(artifact);
    expect(
      Schema.decodeUnknownSync(InvoiceDocumentArtifact)({ ...artifact, invoiceNumber: 'F-000001' })
        .invoiceNumber,
    ).toBe('F-000001');
    expect(() =>
      Schema.decodeUnknownSync(InvoiceDocumentArtifact)({ ...artifact, kind: 'quote-pdf' }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(InvoiceDocumentArtifact)({ ...artifact, sha256: 'invalid' }),
    ).toThrow();
  });

  it('rejects blank client names in invoice responses', () => {
    expect(() =>
      Schema.decodeUnknownSync(InvoiceRevision.fields.clientDisplayName)('   '),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(InvoiceSummary.fields.clientDisplayName)('   '),
    ).toThrow();
  });
});
