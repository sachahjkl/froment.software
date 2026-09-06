import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ClientsApi } from './clients-api';
import { InvoicesApi } from './invoices-api';
import { InvoiceReminder } from './invoice-reminder';

const id = '01ARZ3NDEKTSV4RRFFQ69G5FAY';
const invoice = () => ({
  status: 'issued',
  clientId: id,
  invoiceNumber: 'FA-2026-000001',
  currentRevision: { totalCents: 10000, currency: 'EUR', dueDate: '2026-09-01' },
  payments: [
    { amountCents: 2500, cancelledAt: null },
    { amountCents: 1000, cancelledAt: '2026-09-02T00:00:00.000Z' },
  ],
});

describe('InvoiceReminder', () => {
  const invoices = { get: vi.fn() };
  const clients = { get: vi.fn() };
  beforeEach(() => {
    invoices.get.mockReset().mockResolvedValue({ success: true, result: invoice() });
    clients.get
      .mockReset()
      .mockResolvedValue({ success: true, result: { email: 'current@example.test' } });
    TestBed.configureTestingModule({
      providers: [
        { provide: InvoicesApi, useValue: invoices },
        { provide: ClientsApi, useValue: clients },
      ],
    });
  });

  it('prepares the active balance and current recipient without sending a message', async () => {
    const draft = await TestBed.inject(InvoiceReminder).prepare(id);
    expect(draft?.recipient).toBe('current@example.test');
    expect(draft?.reference).toBe('FA-2026-000001');
    expect(draft?.body).toMatch(/75[,.]00/);
    expect(draft?.body).toContain('2026');
    expect(clients.get).toHaveBeenCalledWith(id);
  });

  it.each(['draft', 'paid', 'void'])('rejects a %s invoice', async (status) => {
    invoices.get.mockResolvedValue({ success: true, result: { ...invoice(), status } });
    expect(await TestBed.inject(InvoiceReminder).prepare(id)).toBeUndefined();
    expect(clients.get).not.toHaveBeenCalled();
  });

  it('rejects a fully settled invoice even if its status still says issued', async () => {
    invoices.get.mockResolvedValue({
      success: true,
      result: {
        ...invoice(),
        payments: [{ amountCents: 10000, cancelledAt: null }],
      },
    });
    expect(await TestBed.inject(InvoiceReminder).prepare(id)).toBeUndefined();
  });

  it('does not prepare a message when access to the invoice is denied', async () => {
    invoices.get.mockResolvedValue({ success: false });
    expect(await TestBed.inject(InvoiceReminder).prepare(id)).toBeUndefined();
    expect(clients.get).not.toHaveBeenCalled();
  });
});
