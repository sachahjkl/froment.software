import { TestBed } from '@angular/core/testing';
import { provideAccount } from '@backoffice/account.spec-helper';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { InvoicesApi } from '@backoffice/invoices-api';
import { ReceiptList } from './receipt-list';
import { inputValue } from '../billing/billing.spec-helper';

describe('ReceiptList', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('keeps the CSV period after an export error', async () => {
    const exportPayments = vi
      .fn()
      .mockResolvedValue({ success: false, code: 'payment.export_too_large' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: InvoicesApi,
          useValue: { receipts: async () => ({ success: true, result: [] }), exportPayments },
        },
      ],
    });
    const fixture = TestBed.createComponent(ReceiptList);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector('summary')?.click();
    const fields = root.querySelectorAll<HTMLInputElement>('.payment-export input');
    inputValue(fields.item(0), '2026-08-01');
    inputValue(fields.item(1), '2026-08-31');
    root
      .querySelector('.payment-export form')
      ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(exportPayments).toHaveBeenCalledWith({ from: '2026-08-01', to: '2026-08-31' });
    expect(fields.item(0).value).toBe('2026-08-01');
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/10[ ,]000/);
  });
});
