import { SupplierInvoice, SupplierPaymentBatch, SupplierSummary } from '@froment/contracts';
import { Schema } from 'effect';
import Sqlite from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  setIssuer,
  startHttpTestServer,
  type HttpTestServer,
} from '../server/server.spec-helper.js';

describe('supplier invoice HTTP lifecycle', () => {
  const settingsEncryptionKeyBytes = 32;
  const settingsEncryptionKey = Buffer.alloc(settingsEncryptionKeyBytes, 's').toString('base64');
  let server: HttpTestServer;

  beforeAll(async () => {
    server = await startHttpTestServer({ settingsEncryptionKey });
  }, 30_000);
  afterAll(async () => server.close());

  it('creates an editable draft and freezes it before approval', async () => {
    const write = (path: string, body: typeof Schema.Json.Type, method: 'POST' | 'PUT' = 'POST') =>
      fetch(`${server.baseUrl}${path}`, {
        method,
        headers: server.jsonHeaders,
        body: JSON.stringify(body),
      });
    const supplierResponse = await write('/api/suppliers', {
      requestId: crypto.randomUUID(),
      displayName: 'Supplier invoices test',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: 'France',
      email: 'supplier@example.test',
      phone: '',
      registrationNumber: '',
      vatNumber: '',
      defaultCurrency: 'EUR',
      paymentTermsDays: 30,
      iban: 'FR1420041010050500013M02606',
      bic: 'PSSTFRPPMON',
    });
    expect(supplierResponse.status).toBe(200);
    const supplier = Schema.decodeUnknownSync(SupplierSummary)(await supplierResponse.json());
    const creation = {
      requestId: crypto.randomUUID(),
      supplierId: supplier.id,
      reference: 'SUP-2026-42',
      invoiceDate: '2026-09-01',
      dueDate: '2026-10-01',
      currency: 'EUR',
      lines: [
        { description: 'Service', netTotalCents: 10_001, vatRateBasisPoints: 2_000 },
        { description: 'Exempt fee', netTotalCents: 500, vatRateBasisPoints: 0 },
      ],
      notes: 'Check before payment',
      source: 'manual',
      sourceFileName: null,
      externalSubmissionId: null,
    };
    const createResponse = await write('/api/supplier-invoices', creation);
    expect(createResponse.status).toBe(200);
    const created = Schema.decodeUnknownSync(SupplierInvoice)(await createResponse.json());
    expect(created).toMatchObject({
      supplierName: supplier.displayName,
      status: 'draft',
      netTotalCents: 10_501,
      vatTotalCents: 2_000,
      totalCents: 12_501,
    });
    const repeated = await write('/api/supplier-invoices', creation);
    expect(repeated.status).toBe(200);
    await expect(repeated.json()).resolves.toMatchObject({ id: created.id });

    const updateResponse = await write(
      `/api/supplier-invoices/${created.id}`,
      {
        supplierId: supplier.id,
        reference: creation.reference,
        invoiceDate: creation.invoiceDate,
        dueDate: '2026-10-15',
        currency: creation.currency,
        lines: creation.lines,
        notes: 'Validated totals',
        expectedVersion: created.version,
      },
      'PUT',
    );
    expect(updateResponse.status).toBe(200);
    const updated = Schema.decodeUnknownSync(SupplierInvoice)(await updateResponse.json());
    expect(updated).toMatchObject({ dueDate: '2026-10-15', version: 2 });

    const confirmResponse = await write(`/api/supplier-invoices/${created.id}/confirm`, {
      expectedVersion: updated.version,
    });
    expect(confirmResponse.status).toBe(200);
    const confirmed = Schema.decodeUnknownSync(SupplierInvoice)(await confirmResponse.json());
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      version: 3,
      functionalCurrency: 'EUR',
      exchangeRateDate: '2026-09-01',
      foreignUnitsPerFunctionalUnitNanos: 1_000_000_000,
      functionalNetTotalCents: 10_501,
      functionalVatTotalCents: 2_000,
      functionalTotalCents: 12_501,
    });
    expect(confirmed.confirmedAt).not.toBeNull();

    const frozenResponse = await write(
      `/api/supplier-invoices/${created.id}`,
      {
        supplierId: supplier.id,
        reference: creation.reference,
        invoiceDate: creation.invoiceDate,
        dueDate: creation.dueDate,
        currency: creation.currency,
        lines: creation.lines,
        notes: '',
        expectedVersion: confirmed.version,
      },
      'PUT',
    );
    expect(frozenResponse.status).toBe(409);
    await expect(frozenResponse.json()).resolves.toMatchObject({
      code: 'supplier_invoice.not_editable',
    });

    const approveResponse = await write(`/api/supplier-invoices/${created.id}/approve`, {
      expectedVersion: confirmed.version,
    });
    expect(approveResponse.status).toBe(200);
    const approved = Schema.decodeUnknownSync(SupplierInvoice)(await approveResponse.json());
    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).not.toBeNull();

    const paymentRequest = {
      requestId: crypto.randomUUID(),
      executionDate: '2026-10-15',
      invoiceIds: [approved.id],
    };
    const incompleteAccount = await write('/api/supplier-payment-batches', paymentRequest);
    expect(incompleteAccount.status).toBe(409);
    await expect(incompleteAccount.json()).resolves.toMatchObject({
      code: 'supplier_payment_batch.debtor_account_incomplete',
    });
    await setIssuer(server);
    const paymentResponse = await write('/api/supplier-payment-batches', paymentRequest);
    expect(paymentResponse.status).toBe(200);
    const payment = Schema.decodeUnknownSync(SupplierPaymentBatch)(await paymentResponse.json());
    expect(payment).toMatchObject({
      executionDate: paymentRequest.executionDate,
      transactionCount: 1,
      controlSumCents: approved.totalCents,
    });
    const repeatedPayment = await write('/api/supplier-payment-batches', paymentRequest);
    await expect(repeatedPayment.json()).resolves.toMatchObject({ id: payment.id });

    const foreignCreateResponse = await write('/api/supplier-invoices', {
      ...creation,
      requestId: crypto.randomUUID(),
      reference: 'SUP-2026-USD',
      currency: 'USD',
    });
    const foreignDraft = Schema.decodeUnknownSync(SupplierInvoice)(
      await foreignCreateResponse.json(),
    );
    const missingRate = await write(`/api/supplier-invoices/${foreignDraft.id}/confirm`, {
      expectedVersion: foreignDraft.version,
    });
    expect(missingRate.status).toBe(409);
    await expect(missingRate.json()).resolves.toMatchObject({
      code: 'supplier_invoice.exchange_rate_missing',
    });
    await write(
      '/api/company/exchange-rates',
      {
        rateDate: creation.invoiceDate,
        foreignCurrency: 'USD',
        foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      },
      'PUT',
    );
    const foreignConfirm = await write(`/api/supplier-invoices/${foreignDraft.id}/confirm`, {
      expectedVersion: foreignDraft.version,
    });
    expect(foreignConfirm.status).toBe(200);
    expect(Schema.decodeUnknownSync(SupplierInvoice)(await foreignConfirm.json())).toMatchObject({
      functionalCurrency: 'EUR',
      exchangeRateDate: creation.invoiceDate,
      foreignUnitsPerFunctionalUnitNanos: 1_100_000_000,
      functionalNetTotalCents: 9_546,
      functionalVatTotalCents: 1_818,
      functionalTotalCents: 11_364,
    });
    const paymentDownload = await fetch(
      `${server.baseUrl}/api/supplier-payment-batches/${payment.id}/download`,
      { headers: server.sessionHeaders },
    );
    expect(paymentDownload.status).toBe(200);
    expect(paymentDownload.headers.get('content-type')).toContain('application/xml');
    expect(paymentDownload.headers.get('content-disposition')).toContain(`${payment.id}.xml`);
    const pain001 = await paymentDownload.text();
    expect(pain001).toContain('<InstdAmt Ccy="EUR">125.01</InstdAmt>');
    expect(pain001).toContain(`<IBAN>FR1420041010050500013M02606</IBAN>`);
    const paymentList = await fetch(`${server.baseUrl}/api/supplier-payment-batches`, {
      headers: server.sessionHeaders,
    });
    expect(paymentList.status).toBe(200);
    await expect(paymentList.json()).resolves.toMatchObject([{ id: payment.id }]);
    expect(
      (
        await write(`/api/supplier-invoices/${created.id}/cancel`, {
          expectedVersion: approved.version,
        })
      ).status,
    ).toBe(409);
  });

  it('protects reads and rejects duplicate supplier references', async () => {
    expect((await fetch(`${server.baseUrl}/api/supplier-invoices`)).status).toBe(401);
    const listResponse = await fetch(`${server.baseUrl}/api/supplier-invoices`, {
      headers: server.sessionHeaders,
    });
    expect(listResponse.status).toBe(200);
    const list = Schema.decodeUnknownSync(Schema.Array(SupplierInvoice))(await listResponse.json());
    expect(list).toHaveLength(2);
  });

  it('creates an OCR draft and records explicit external consent', async () => {
    const supplierResponse = await fetch(`${server.baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({
        requestId: crypto.randomUUID(),
        displayName: 'OCR supplier',
        addressLine1: '',
        addressLine2: '',
        postalCode: '',
        city: '',
        country: 'France',
        email: '',
        phone: '',
        registrationNumber: '',
        vatNumber: '',
        defaultCurrency: 'EUR',
        paymentTermsDays: 30,
        iban: '',
        bic: '',
      }),
    });
    const supplier = Schema.decodeUnknownSync(SupplierSummary)(await supplierResponse.json());
    const analysisRequest = {
      requestId: crypto.randomUUID(),
      supplierId: supplier.id,
      fileName: 'OCR-2026-9.pdf',
      mediaType: 'application/pdf',
      contentBase64: Buffer.from('fixture document').toString('base64'),
      consent: false,
    };
    const analysisResponse = await fetch(`${server.baseUrl}/api/supplier-invoices/analyze`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify(analysisRequest),
    });
    expect(analysisResponse.status).toBe(200);
    const invoice = Schema.decodeUnknownSync(SupplierInvoice)(await analysisResponse.json());
    expect(invoice).toMatchObject({
      supplierId: supplier.id,
      reference: 'OCR-2026-9',
      source: 'ocr',
      sourceFileName: analysisRequest.fileName,
      status: 'draft',
    });

    const settingsResponse = await fetch(
      `${server.baseUrl}/api/supplier-invoice-analysis/settings`,
      {
        method: 'PUT',
        headers: server.jsonHeaders,
        body: JSON.stringify({
          adapter: 'http',
          endpoint: 'https://analysis.example.test/invoices',
          apiKey: 'external-secret',
        }),
      },
    );
    expect(settingsResponse.status).toBe(200);
    await expect(settingsResponse.json()).resolves.toMatchObject({
      adapter: 'http',
      credentialsPresent: true,
      external: true,
    });

    const deniedResponse = await fetch(`${server.baseUrl}/api/supplier-invoices/analyze`, {
      method: 'POST',
      headers: server.jsonHeaders,
      body: JSON.stringify({ ...analysisRequest, requestId: crypto.randomUUID() }),
    });
    expect(deniedResponse.status).toBe(409);
    await expect(deniedResponse.json()).resolves.toMatchObject({
      code: 'supplier_invoice.analysis_consent_required',
    });

    const sqlite = new Sqlite(server.databaseFilename, { readonly: true });
    const settings = sqlite
      .prepare(
        `select encrypted_api_key as encryptedApiKey, encryption_iv as encryptionIv,
         encryption_tag as encryptionTag from supplier_invoice_analysis_settings where id = 1`,
      )
      .get() as {
      encryptedApiKey: string;
      encryptionIv: string;
      encryptionTag: string;
    };
    expect(settings.encryptedApiKey).not.toContain('external-secret');
    expect(settings.encryptionIv).toBeTruthy();
    expect(settings.encryptionTag).toBeTruthy();
    expect(
      sqlite
        .prepare(
          `select count(*) as count from audit_events
           where action in ('supplier-invoice.analysis-settings-updated', 'supplier-invoice.analysis-submitted')`,
        )
        .get(),
    ).toEqual({ count: 2 });
    expect(
      sqlite
        .prepare(
          `select adapter, consent_at as consentAt, status
           from supplier_invoice_analysis_submissions where request_id = ?`,
        )
        .get(analysisRequest.requestId),
    ).toEqual({ adapter: 'local', consentAt: null, status: 'completed' });
    sqlite.close();
  });
});
