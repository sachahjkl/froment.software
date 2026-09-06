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
  matchedCents: 0,
  allocations: [],
};
describe('Banking', () => {
  it('loads preserved history on demand and keeps cancellation reasons as text', async () => {
    const history = vi.fn(async () => ({
      success: true,
      result: [
        {
          id: transaction.id,
          invoiceId: transaction.id,
          invoiceNumber: 'FA-2026-000001',
          amountCents: 10000,
          matchedAt: transaction.importedAt,
          matchedByUserId: transaction.id,
          cancelledAt: transaction.importedAt,
          cancelledByUserId: transaction.id,
          cancellationReason: '<script>incorrect match</script>',
        },
      ],
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BankingApi, useValue: { list: async () => [transaction], history } },
        { provide: InvoicesApi, useValue: { list: async () => [] } },
      ],
    });
    const fixture = TestBed.createComponent(Banking);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(history).not.toHaveBeenCalled();
    const disclosure = root.querySelector<HTMLButtonElement>('button[aria-expanded]');
    disclosure?.click();
    await fixture.whenStable();
    expect(history).toHaveBeenCalledWith(transaction.id);
    expect(disclosure?.getAttribute('aria-expanded')).toBe('true');
    expect(root.textContent).toContain('<script>incorrect match</script>');
    expect(root.querySelector('script')).toBeNull();
    disclosure?.click();
    await fixture.whenStable();
    expect(disclosure?.getAttribute('aria-expanded')).toBe('false');
    disclosure?.click();
    await fixture.whenStable();
    expect(history).toHaveBeenCalledTimes(2);
  });
  it('offers only matching active payments and confirms reconciliation without recording money', async () => {
    const match = vi.fn(async () => ({
      success: true,
      result: [
        {
          ...transaction,
          matchedCents: 10000,
          allocations: [
            {
              paymentId: transaction.id,
              matchId: transaction.id,
              invoiceId: transaction.id,
              invoiceNumber: 'FA-2026-000001',
              amountCents: 10000,
              paymentCancelled: false,
            },
          ],
        },
      ],
    }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: BankingApi,
          useValue: {
            list: async () => [transaction],
            match,
            payments: async () => ({
              success: true,
              result: [
                {
                  id: transaction.id,
                  amountCents: 10000,
                  availableCents: 10000,
                  paidOn: transaction.bookedOn,
                  reference: 'MATCH',
                },
                {
                  id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
                  amountCents: 5000,
                  availableCents: 5000,
                  paidOn: transaction.bookedOn,
                  reference: 'PARTIAL',
                },
                {
                  id: '01ARZ3NDEKTSV4RRFFQ69G5FAX',
                  amountCents: 10000,
                  availableCents: 0,
                  paidOn: transaction.bookedOn,
                  reference: 'USED',
                },
              ],
            }),
          },
        },
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
    expect(payment.options).toHaveLength(3);
    payment.value = transaction.id;
    payment.dispatchEvent(new Event('input', { bubbles: true }));
    payment.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();
    const confirm = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    root.querySelector<HTMLButtonElement>('.editor button')?.click();
    await fixture.whenStable();
    expect(match).toHaveBeenCalledWith(transaction.id, {
      paymentId: transaction.id,
      amountCents: 10000,
      requestId: expect.any(String),
    });
    expect(root.querySelectorAll('li')).toHaveLength(0);
    expect(root.querySelector('.editor')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('[role="status"]'));
    confirm.mockRestore();
  });
});
import { Confirmation } from '@shared/confirmation/confirmation';
