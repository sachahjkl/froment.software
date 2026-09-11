import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QuotesApi } from '@backoffice/quotes-api';
import { accountFixture } from '@backoffice/account.spec-helper';
import { QuoteDocument } from './quote-document';
import { quoteFixture } from '../commercial.spec-helper';

describe('stored quote PDF access', () => {
  it('offers only an available PDF without requiring render permission', async () => {
    const context = accountFixture(['document.download']);
    const renderPdf = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        context.provider,
        { provide: QuotesApi, useValue: { renderPdf } },
      ],
    });
    const fixture = TestBed.createComponent(QuoteDocument);
    fixture.componentRef.setInput('quoteId', quoteFixture.id);
    fixture.componentRef.setInput('clientId', quoteFixture.clientId);
    fixture.componentRef.setInput('revision', {
      ...quoteFixture.currentRevision,
      pdfAvailable: true,
    });
    await fixture.whenStable();
    const pdfLink = () => fixture.nativeElement.querySelector('a[href$="/pdf"]');
    expect(pdfLink()).not.toBeNull();
    expect(renderPdf).not.toHaveBeenCalled();
    fixture.componentRef.setInput('revision', {
      ...quoteFixture.currentRevision,
      pdfAvailable: false,
    });
    await fixture.whenStable();
    expect(pdfLink()).toBeNull();
    fixture.componentRef.setInput('revision', {
      ...quoteFixture.currentRevision,
      pdfAvailable: true,
    });
    context.account.set(undefined);
    await fixture.whenStable();
    expect(pdfLink()).toBeNull();
  });
});
