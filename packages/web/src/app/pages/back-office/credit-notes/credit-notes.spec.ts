import { TestBed } from '@angular/core/testing';
import { provideAccount } from '@backoffice/account.spec-helper';
import { provideRouter } from '@angular/router';
import { InvoicesApi } from '@backoffice/invoices-api';
import { CreditNotes } from './credit-notes';
import { creditFixture, invoiceFixture } from '../billing/billing.spec-helper';

describe('CreditNotes', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('reads the protected global list without creating editable financial forms', async () => {
    const invoice = invoiceFixture();
    const note = creditFixture().creditNote;
    if (!note) throw new Error('billing.test.credit_missing');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: InvoicesApi,
          useValue: {
            credits: async () => ({
              success: true,
              result: [
                {
                  ...note,
                  invoiceId: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  title: invoice.currentRevision.title,
                  clientId: invoice.clientId,
                  clientDisplayName: 'Acme',
                  orderId: invoice.orderId,
                  orderReference: invoice.orderReference,
                },
              ],
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CreditNotes);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('tbody a')?.textContent).toContain('AV-2026-000001');
    expect(root.querySelector('tbody a')?.getAttribute('href')).toContain('tab=credit');
    expect(root.querySelector('textarea')).toBeNull();
  });
  it('distinguishes a failed request from an empty list', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: InvoicesApi,
          useValue: { credits: async () => ({ success: false, code: 'invoice.error' }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(CreditNotes);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });
});
