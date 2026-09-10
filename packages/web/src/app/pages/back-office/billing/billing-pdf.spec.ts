import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { type InvoiceSummaryValue } from '@froment/contracts';
import { vi } from 'vitest';
import { BillingPdf } from './billing-pdf';
import { invoiceFixture } from './billing.spec-helper';

const createObjectUrl = vi.fn<typeof URL.createObjectURL>();
const revokeObjectUrl = vi.fn<(url: string) => void>();
class DownloadUrl extends URL {
  static override createObjectURL = createObjectUrl;
  static override revokeObjectURL = revokeObjectUrl;
}

describe('Billing PDF downloads', () => {
  const first: InvoiceSummaryValue = {
    ...invoiceFixture(),
    title: 'Audit',
    clientDisplayName: 'Acme',
    dueDate: '2026-09-20',
    currency: 'EUR',
    totalCents: 1200,
    recordedPaidCents: 0,
    updatedAt: '2026-08-20T06:00:00.000Z',
  };
  const second: InvoiceSummaryValue = {
    ...first,
    id: '01ARZ3NDEKTSV4RRFFQ69G5FC1',
    invoiceNumber: 'FA-2026-000002',
    version: 3,
  };
  const path = (invoice: InvoiceSummaryValue) =>
    `/api/invoices/${invoice.id}/revisions/${invoice.version}/pdf`;
  const body = new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' });
  const click = vi.fn<(this: HTMLAnchorElement) => void>();
  let http: HttpTestingController;
  let downloads: BillingPdf;

  beforeEach(() => {
    createObjectUrl
      .mockReset()
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second');
    revokeObjectUrl.mockReset();
    click.mockReset();
    vi.stubGlobal('URL', DownloadUrl);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), BillingPdf],
    });
    http = TestBed.inject(HttpTestingController);
    downloads = TestBed.inject(BillingPdf);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads only selected ready PDFs and downloads the returned bytes with their recorded versions', async () => {
    const pending: InvoiceSummaryValue = {
      ...first,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FC2',
      pdf: { status: 'pending', attempts: 0, error: null },
    };
    const missing: InvoiceSummaryValue = {
      ...pending,
      id: '01ARZ3NDEKTSV4RRFFQ69G5FC3',
      pdf: null,
    };
    const result = downloads.download([first, pending, missing, second]);
    expect(downloads.pending()).toBe(true);
    const request = http.expectOne(path(first));
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    expect(createObjectUrl).not.toHaveBeenCalled();
    await downloads.download([first]);
    http.expectNone(path(first));
    request.flush(body);
    await Promise.resolve();
    const next = http.expectOne(path(second));
    expect(next.request.method).toBe('GET');
    next.flush(body);
    await result;
    http.expectNone(path(pending));
    http.expectNone(path(missing));
    expect(createObjectUrl).toHaveBeenCalledTimes(2);
    expect(createObjectUrl).toHaveBeenNthCalledWith(1, body);
    expect(createObjectUrl).toHaveBeenNthCalledWith(2, body);
    expect(click.mock.contexts.map((link) => [link.href, link.download, link.isConnected])).toEqual(
      [
        ['blob:first', 'FA-2026-000001-v2.pdf', false],
        ['blob:second', 'FA-2026-000002-v3.pdf', false],
      ],
    );
    expect(downloads.pending()).toBe(false);
    expect(downloads.failed()).toBe(false);
    TestBed.resetTestingModule();
    expect(revokeObjectUrl.mock.calls).toEqual([['blob:first'], ['blob:second']]);
  });

  it('reports a failed HTTP read without downloading its error body and allows a retry', async () => {
    const result = downloads.download([first]);
    http.expectOne(path(first)).flush(new Blob(['unavailable']), {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await result;
    expect(downloads.failed()).toBe(true);
    expect(downloads.pending()).toBe(false);
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    const retry = downloads.download([first]);
    http.expectOne(path(first)).flush(body);
    await retry;
    expect(downloads.failed()).toBe(false);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-PDF response instead of saving HTML as a PDF', async () => {
    const result = downloads.download([first]);
    http.expectOne(path(first)).flush(new Blob(['<html></html>'], { type: 'text/html' }));
    await result;
    expect(downloads.failed()).toBe(true);
    expect(downloads.pending()).toBe(false);
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('cancels an in-flight read on destruction without starting the next PDF', async () => {
    const result = downloads.download([first, second]);
    const request = http.expectOne(path(first));
    TestBed.resetTestingModule();
    await result;
    expect(request.cancelled).toBe(true);
    http.expectNone(path(second));
    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
  });

  it('releases a Blob URL after the download starts and never releases it twice', async () => {
    vi.useFakeTimers();
    const result = downloads.download([first]);
    http.expectOne(path(first)).flush(body);
    await result;
    vi.advanceTimersByTime(999);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectUrl).toHaveBeenCalledExactlyOnceWith('blob:first');
    TestBed.resetTestingModule();
    expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
  });
});
