import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { InvoicesApi } from '@backoffice/invoices-api';
import { InvoiceCreditsApi } from '@backoffice/invoice-credits-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { CreditNotes } from './credit-notes';

describe('CreditNotes', () => {
  afterEach(() => vi.restoreAllMocks());
  it('guards unsaved reasons and reuses the request key after a failed issue response', async () => {
    const issue = vi.fn(async () => ({ success: false, code: 'invoice.credit_conflict' }));
    const confirm = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: new Map([['invoiceId', '01ARZ3NDEKTSV4RRFFQ69G5FAV']]) },
          },
        },
        {
          provide: InvoicesApi,
          useValue: {
            get: async () => ({
              success: true,
              result: { status: 'issued', version: 2, invoiceNumber: 'FA-2026-000001' },
            }),
          },
        },
        {
          provide: InvoiceCreditsApi,
          useValue: {
            get: async () => ({
              success: true,
              result: { creditNote: null, refunds: [], refundableCents: 0 },
            }),
            issue,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(CreditNotes);
    await fixture.whenStable();
    await fixture.componentInstance['load']();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const reason = root.querySelector('textarea');
    if (!reason) throw new Error('credit.test.reason_missing');
    reason.value = '<b>Service cancelled</b>';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const submit = async () => {
      root
        .querySelector('form')
        ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    await submit();
    expect(issue).not.toHaveBeenCalled();
    confirm.mockResolvedValue(true);
    await submit();
    await submit();
    expect(issue).toHaveBeenCalledTimes(2);
    expect(issue.mock.calls[0]).toEqual(issue.mock.calls[1]);
    expect(reason.value).toBe('<b>Service cancelled</b>');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
});
