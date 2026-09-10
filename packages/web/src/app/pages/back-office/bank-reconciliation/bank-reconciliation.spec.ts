import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { type BankPaymentList } from '@froment/contracts';
import { BankReconciliation } from './bank-reconciliation';
import {
  bankField,
  bankHistory,
  bankSortHeader,
  bankId,
  bankRoot,
  bankSubmit,
  bankTransaction,
  otherBankId,
  setupBankWorkspace,
} from '../banking/bank-workspace.spec-helper';

describe('Bank reconciliation task', () => {
  it('keeps the transaction context and prepares its remaining amount after a partial allocation', async () => {
    const { api } = setupBankWorkspace();
    api.match.mockResolvedValue({
      success: true,
      result: [
        {
          ...bankTransaction,
          matchedCents: 5000,
          allocations: [
            {
              matchId: otherBankId,
              paymentId: bankId,
              invoiceId: bankId,
              invoiceNumber: 'FA-2026-000001',
              amountCents: 5000,
              feeCents: 0,
              paymentCancelled: false,
            },
          ],
        },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/backoffice/banque/transactions/${bankId}`, BankReconciliation);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, 'form select', bankId);
    await harness.fixture.whenStable();
    bankField(root, 'form select[aria-describedby="payment-error"]', bankId);
    bankField(root, 'input[aria-describedby="amount-error net-error"]', '50.00');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(
      root.querySelector<HTMLInputElement>('input[aria-describedby="amount-error net-error"]')
        ?.value,
    ).toBe('50.00');
    expect(root.textContent).toContain('Partiellement rapproché');
    expect(root.querySelectorAll('tbody button')).toHaveLength(1);
    expect(root.querySelector('aside')?.textContent).toContain('BANK-1');
    expect(
      root.querySelector<HTMLSelectElement>('select[aria-describedby="payment-error"]')?.value,
    ).toBe('');
  });
  it('renders immutable history as text and retries the same partial allocation snapshot', async () => {
    const { api } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/backoffice/banque/transactions/${bankId}`, BankReconciliation);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    expect(root.textContent).toContain('<script>Erreur de rapprochement</script>');
    expect(root.querySelector('script')).toBeNull();
    bankField(root, 'form select', bankId);
    await harness.fixture.whenStable();
    bankField(root, 'form select[aria-describedby="payment-error"]', bankId);
    bankField(root, 'input[aria-describedby="amount-error net-error"]', '60,00');
    bankField(root, 'input[aria-describedby="fee-error fee-hint"]', '2,00');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.match).toHaveBeenCalledWith(bankId, {
      paymentId: bankId,
      amountCents: 6000,
      feeCents: 200,
      requestId: expect.any(String),
    });
    expect(
      root.querySelector<HTMLInputElement>('input[aria-describedby="amount-error net-error"]')
        ?.disabled,
    ).toBe(true);
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.match.mock.calls[0]).toEqual(api.match.mock.calls[1]);
  });
  it('focuses an invalid amount and does not submit excess precision or a net over the remaining credit', async () => {
    const { api } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/backoffice/banque/transactions/${bankId}`, BankReconciliation);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, 'form select', bankId);
    await harness.fixture.whenStable();
    bankField(root, 'form select[aria-describedby="payment-error"]', bankId);
    bankField(root, 'input[aria-describedby="amount-error net-error"]', '1.001');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.match).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      root.querySelector('input[aria-describedby="amount-error net-error"]'),
    );
    bankField(root, 'input[aria-describedby="amount-error net-error"]', '101.00');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(api.match).not.toHaveBeenCalled();
    expect(root.textContent).toContain('dépasse le crédit restant');
  });
  it('ties the cancellation reason to the selected allocation and blocks dirty navigation', async () => {
    const { api, confirmation } = setupBankWorkspace();
    const allocation = {
      matchId: bankId,
      paymentId: bankId,
      invoiceId: bankId,
      invoiceNumber: 'FA-2026-000001',
      amountCents: 5000,
      feeCents: 100,
      paymentCancelled: true,
    };
    api.get.mockResolvedValue({
      success: true,
      result: {
        ...bankTransaction,
        matchedCents: 9800,
        allocations: [allocation, { ...allocation, matchId: otherBankId, paymentId: otherBankId }],
      },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/backoffice/banque/transactions/${bankId}`, BankReconciliation);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    root.querySelectorAll<HTMLButtonElement>('tbody button')[1]?.click();
    await harness.fixture.whenStable();
    bankField(root, 'textarea', 'Encaissement annulé');
    await harness.fixture.whenStable();
    confirmation.request.mockResolvedValue(false);
    await harness.navigateByUrl('/backoffice/banque');
    expect(TestBed.inject(Router).url).toContain(`/transactions/${bankId}`);
    confirmation.request.mockResolvedValue(true);
    bankSubmit(root, 'form.ds-panel');
    await harness.fixture.whenStable();
    expect(api.unmatch).toHaveBeenCalledWith(bankId, otherBankId, 'Encaissement annulé');
    expect(root.querySelector('textarea')).toBeNull();
  });
  it('discards stale payment lists after an invoice change', async () => {
    const { api } = setupBankWorkspace();
    type PaymentOutcome = { success: true; result: typeof BankPaymentList.Type };
    let resolvePayments: ((outcome: PaymentOutcome) => void) | undefined;
    const late = new Promise<PaymentOutcome>((resolve) => {
      resolvePayments = resolve;
    });
    api.payments.mockImplementationOnce(() => late);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/backoffice/banque/transactions/${bankId}`, BankReconciliation);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, 'form select', bankId);
    await harness.fixture.whenStable();
    bankField(root, 'form select', otherBankId);
    await harness.fixture.whenStable();
    if (!resolvePayments) throw new Error('bank.test.payment_resolver_missing');
    resolvePayments({
      success: true,
      result: [
        {
          id: otherBankId,
          reference: 'STALE',
          amountCents: 1000,
          availableCents: 1000,
          paidOn: '2026-09-01',
        },
      ],
    });
    await harness.fixture.whenStable();
    expect(
      root.querySelector('select[aria-describedby="payment-error"]')?.textContent,
    ).not.toContain('STALE');
  });
  it('sorts allocations and history independently without clearing a cancellation reason', async () => {
    const { api, confirmation } = setupBankWorkspace();
    const first = bankHistory[0];
    if (!first) throw new Error('bank.test.history_missing');
    const allocation = {
      matchId: bankId,
      paymentId: bankId,
      invoiceId: bankId,
      invoiceNumber: 'FA-2',
      amountCents: 900,
      feeCents: 0,
      paymentCancelled: false,
    };
    api.get.mockResolvedValue({
      success: true,
      result: {
        ...bankTransaction,
        allocations: [
          allocation,
          {
            ...allocation,
            matchId: otherBankId,
            paymentId: otherBankId,
            amountCents: 10000,
            feeCents: 300,
          },
        ],
      },
    });
    api.history.mockResolvedValue({
      success: true,
      result: [
        { ...first, amountCents: 900, matchedAt: '2026-09-01T12:00:00.000Z' },
        { ...first, id: otherBankId, amountCents: 10000, matchedAt: '2026-09-02T12:00:00.000Z' },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/backoffice/banque/transactions/${bankId}?sort=amount-desc`,
      BankReconciliation,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    const allocations = root.querySelector<HTMLElement>(
      'section[aria-labelledby="allocations-title"]',
    );
    const history = root.querySelector<HTMLElement>('section[aria-labelledby="history-title"]');
    if (!allocations || !history) throw new Error('bank.test.table_missing');
    expect(allocations.querySelectorAll('thead button[appTableSort]')).toHaveLength(4);
    expect(allocations.querySelector('thead th:last-child')?.hasAttribute('aria-sort')).toBe(false);
    allocations.querySelector<HTMLButtonElement>('tbody button')?.click();
    await harness.fixture.whenStable();
    bankField(allocations, 'textarea', 'Motif conservé');
    bankSortHeader(allocations, 'Commission :').querySelector('button')?.click();
    await harness.fixture.whenStable();
    bankSortHeader(allocations, 'Commission :').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(allocations.querySelector('tbody tr')?.textContent).toContain(otherBankId);
    expect(allocations.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Motif conservé',
    );
    bankSortHeader(history, 'Règlement associé').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('historySort=date-asc');
    expect(TestBed.inject(Router).url).toContain('allocationSort=fee-desc');
    expect(TestBed.inject(Router).url).toContain('sort=amount-desc');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(confirmation.request).not.toHaveBeenCalled();
    expect(root.querySelector('.bank-page > a')?.getAttribute('href')).toContain(
      'sort=amount-desc',
    );
  });
});
