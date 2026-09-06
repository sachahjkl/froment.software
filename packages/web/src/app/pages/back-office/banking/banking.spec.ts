import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { type BankTransactionValue } from '@froment/contracts';
import { BankingApi } from '@backoffice/banking-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { Banking } from './banking';

const transaction: BankTransactionValue = {
  id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  account: 'Main',
  reference: 'BANK-1',
  bookedOn: '2026-09-01',
  amountCents: 10000,
  description: 'Receipt',
  importedAt: '2026-09-01T12:00:00.000Z',
  matchId: null,
  paymentId: null,
  invoiceId: null,
  invoiceNumber: null,
  paymentCancelled: false,
};
describe('Banking', () => {
  it('offers only matching active payments and confirms reconciliation without recording money', async () => {
    const match = vi.fn(async () => ({
      success: true,
      result: [
        {
          ...transaction,
          paymentId: transaction.id,
          matchId: transaction.id,
          invoiceId: transaction.id,
          invoiceNumber: 'FA-2026-000001',
        },
      ],
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BankingApi, useValue: { list: async () => [transaction], match } },
        {
          provide: InvoicesApi,
          useValue: {
            list: async () => [
              {
                id: transaction.id,
                invoiceNumber: 'FA-2026-000001',
                status: 'issued',
                title: 'Test',
              },
            ],
            get: async () => ({
              success: true,
              result: {
                payments: [
                  {
                    id: transaction.id,
                    amountCents: 10000,
                    cancelledAt: null,
                    paidOn: transaction.bookedOn,
                    reference: 'MATCH',
                  },
                  { id: '01ARZ3NDEKTSV4RRFFQ69G5FAW', amountCents: 5000, cancelledAt: null },
                  {
                    id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
                    amountCents: 10000,
                    cancelledAt: transaction.importedAt,
                  },
                ],
              },
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Banking);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('li button')?.click();
    await fixture.whenStable();
    const invoice = root.querySelector<HTMLSelectElement>('.editor select');
    if (invoice === null) throw new Error('bank.invoice.input.missing');
    invoice.value = transaction.id;
    invoice.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    const payment = root.querySelectorAll<HTMLSelectElement>('.editor select')[1];
    if (payment === undefined) throw new Error('bank.payment.input.missing');
    expect(payment.options).toHaveLength(2);
    payment.value = transaction.id;
    payment.dispatchEvent(new Event('input', { bubbles: true }));
    payment.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    const confirm = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('.editor button')?.click();
    await fixture.whenStable();
    expect(match).toHaveBeenCalledWith(transaction.id, transaction.id);
    expect(root.querySelectorAll('li')).toHaveLength(0);
    expect(root.querySelector('.editor')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('[role="status"]'));
    confirm.mockRestore();
  });
});
import { Confirmation } from '@shared/confirmation/confirmation';
