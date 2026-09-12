import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { I18nService } from '@app/i18n.service';
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

function deferredConfirmation() {
  let resolve: ((accepted: boolean) => void) | undefined;
  const promise = new Promise<boolean>((complete) => {
    resolve = complete;
  });
  return {
    promise,
    resolve(accepted: boolean): void {
      if (!resolve) throw new Error('bank.test.confirmation_resolver_missing');
      resolve(accepted);
    },
  };
}

function unloadIsBlocked(): boolean {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe('Bank reconciliation task', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  it('keeps the transaction readable without offering allocation instructions', async () => {
    TestBed.configureTestingModule({ providers: [provideAccount(['bank.read', 'invoice.read'])] });
    setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      `/backoffice/banking/transactions/${bankId}`,
      BankReconciliation,
    );
    await harness.fixture.whenStable();
    expect(page['state']()).toBe('ready');
    expect(page['titleLabel']()).toBe('bankWorkspace.context');
    expect(bankRoot(harness).querySelector('#allocation-title')).toBeNull();
  });
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
    await harness.navigateByUrl(`/backoffice/banking/transactions/${bankId}`, BankReconciliation);
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
    await harness.navigateByUrl(`/backoffice/banking/transactions/${bankId}`, BankReconciliation);
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
    await harness.navigateByUrl(`/backoffice/banking/transactions/${bankId}`, BankReconciliation);
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
    await harness.navigateByUrl(`/backoffice/banking/transactions/${bankId}`, BankReconciliation);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    root.querySelectorAll<HTMLButtonElement>('tbody button')[1]?.click();
    await harness.fixture.whenStable();
    bankField(root, 'textarea', 'Encaissement annulé');
    await harness.fixture.whenStable();
    confirmation.request.mockResolvedValue(false);
    await harness.navigateByUrl('/backoffice/banking');
    expect(TestBed.inject(Router).url).toContain(`/transactions/${bankId}`);
    confirmation.request.mockResolvedValue(true);
    bankSubmit(root, 'form.ds-panel');
    await harness.fixture.whenStable();
    expect(api.unmatch).toHaveBeenCalledWith(bankId, otherBankId, 'Encaissement annulé');
    expect(root.querySelector('textarea')).toBeNull();
  });
  it.each(['cancellation reason', 'match form'])(
    'locks allocation selection while confirming a dirty %s and preserves declined changes',
    async (draft) => {
      const { api, confirmation } = setupBankWorkspace();
      const first = {
        matchId: bankId,
        paymentId: bankId,
        invoiceId: bankId,
        invoiceNumber: 'FA-2026-000001',
        amountCents: 2000,
        feeCents: 100,
        paymentCancelled: false,
      };
      const second = {
        ...first,
        matchId: otherBankId,
        paymentId: otherBankId,
        amountCents: 1000,
        feeCents: 0,
      };
      const transaction = {
        ...bankTransaction,
        matchedCents: 2900,
        allocations: [first, second],
      };
      const source = structuredClone(transaction);
      api.get.mockResolvedValue({ success: true, result: transaction });
      const harness = await RouterTestingHarness.create();
      const path = `/backoffice/banking/transactions/${bankId}?sort=amount-desc`;
      const component = await harness.navigateByUrl(path, BankReconciliation);
      await harness.fixture.whenStable();
      const root = bankRoot(harness);
      const history = structuredClone(component['history']());
      const denied = deferredConfirmation();
      const accepted = deferredConfirmation();
      let selection: Promise<void> | undefined;
      try {
        if (draft === 'cancellation reason') {
          await component['selectCancellation'](first);
          await harness.fixture.whenStable();
          bankField(root, 'textarea', 'Motif de la première allocation');
        } else {
          bankField(root, 'form select', bankId);
          await harness.fixture.whenStable();
          bankField(root, 'select[aria-describedby="payment-error"]', bankId);
          bankField(root, 'input[aria-describedby="amount-error net-error"]', '12.34');
          bankField(root, 'input[aria-describedby="fee-error fee-hint"]', '0.35');
        }
        await harness.fixture.whenStable();
        const matchDraft = { ...component['matchForm']().value() };
        const cancelDraft = { ...component['cancelForm']().value() };
        const originalAllocation = component['cancelling']();
        const focusTarget = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          draft === 'cancellation reason'
            ? 'textarea'
            : 'input[aria-describedby="amount-error net-error"]',
        );
        if (!focusTarget) throw new Error('bank.test.draft_focus_missing');
        focusTarget.focus();
        expect(unloadIsBlocked()).toBe(true);
        expect(confirmation.request).not.toHaveBeenCalled();
        confirmation.request.mockImplementationOnce(() => denied.promise);
        selection = component['selectCancellation'](second);
        expect(confirmation.request).toHaveBeenCalledExactlyOnceWith(
          TestBed.inject(I18nService).t('bankWorkspace.unsaved'),
        );
        expect(component['busy']()).toBe(true);
        await harness.fixture.whenStable();
        expect(focusTarget.disabled).toBe(true);
        expect(component['matchForm']().disabled()).toBe(true);
        expect(component['cancelForm']().disabled()).toBe(true);
        expect(
          [...root.querySelectorAll<HTMLButtonElement>('tbody button')].every(
            (button) => button.disabled,
          ),
        ).toBe(true);
        expect(component['cancelling']()).toBe(originalAllocation);
        expect(component['matchForm']().value()).toEqual(matchDraft);
        expect(component['cancelForm']().value()).toEqual(cancelDraft);
        expect(unloadIsBlocked()).toBe(true);
        expect(await component.canDeactivate()).toBe(false);
        await component['selectCancellation'](first);
        await component['closeCancellation']();
        await component['selectInvoice'](otherBankId);
        await component['refresh']();
        await component['load']();
        bankSubmit(root, 'section[aria-labelledby="allocation-title"] form');
        if (originalAllocation) bankSubmit(root, 'form.ds-panel');
        await harness.navigateByUrl('/backoffice/banking');
        expect(TestBed.inject(Router).url).toBe(path);
        expect(confirmation.request).toHaveBeenCalledTimes(1);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(api.history).toHaveBeenCalledTimes(1);
        expect(api.match).not.toHaveBeenCalled();
        expect(api.unmatch).not.toHaveBeenCalled();
        root.querySelector<HTMLAnchorElement>('a[pageBack]')?.focus();
        denied.resolve(false);
        await selection;
        await harness.fixture.whenStable();
        expect(component['busy']()).toBe(false);
        expect(focusTarget.disabled).toBe(false);
        expect(document.activeElement).toBe(focusTarget);
        expect(component['cancelling']()).toBe(originalAllocation);
        expect(component['matchForm']().value()).toEqual(matchDraft);
        expect(component['cancelForm']().value()).toEqual(cancelDraft);
        expect(component['transaction']()).toEqual(source);
        expect(component['history']()).toEqual(history);
        expect(unloadIsBlocked()).toBe(true);
        confirmation.request.mockResolvedValue(false);
        await component['refresh']();
        await harness.navigateByUrl('/backoffice/banking');
        expect(TestBed.inject(Router).url).toBe(path);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(component['matchForm']().value()).toEqual(matchDraft);
        expect(component['cancelForm']().value()).toEqual(cancelDraft);
        expect(confirmation.request).toHaveBeenCalledTimes(3);
        confirmation.request.mockImplementationOnce(() => accepted.promise);
        selection = component['selectCancellation'](second);
        await harness.fixture.whenStable();
        expect(confirmation.request).toHaveBeenCalledTimes(4);
        expect(component['busy']()).toBe(true);
        expect(component['cancelling']()).toBe(originalAllocation);
        expect(component['matchForm']().value()).toEqual(matchDraft);
        expect(component['cancelForm']().value()).toEqual(cancelDraft);
        expect(unloadIsBlocked()).toBe(true);
        accepted.resolve(true);
        await selection;
        await harness.fixture.whenStable();
        expect(component['busy']()).toBe(false);
        expect(component['cancelling']()).toEqual(second);
        expect(component['cancelForm']().value()).toEqual({ reason: '' });
        expect(component['cancelForm']().disabled()).toBe(false);
        expect(component['matchForm']().value()).toEqual({
          invoiceId: '',
          paymentId: '',
          amount: '71.00',
          fee: '0.00',
        });
        expect(component['payments']()).toEqual([]);
        expect(document.activeElement).toBe(root.querySelector('textarea'));
        expect(root.querySelector('form.ds-panel')?.textContent).toContain(second.paymentId);
        expect(component['transaction']()).toEqual(source);
        expect(component['history']()).toEqual(history);
        expect(api.get).toHaveBeenCalledTimes(1);
        expect(api.history).toHaveBeenCalledTimes(1);
        expect(api.match).not.toHaveBeenCalled();
        expect(api.unmatch).not.toHaveBeenCalled();
        expect(unloadIsBlocked()).toBe(false);
        expect(await component.canDeactivate()).toBe(true);
        await harness.navigateByUrl('/backoffice/banking');
        expect(TestBed.inject(Router).url).toBe('/backoffice/banking');
        expect(confirmation.request).toHaveBeenCalledTimes(4);
      } finally {
        denied.resolve(false);
        accepted.resolve(false);
        await selection;
      }
    },
  );
  it('discards stale payment lists after an invoice change', async () => {
    const { api } = setupBankWorkspace();
    type PaymentOutcome = { success: true; result: typeof BankPaymentList.Type };
    let resolvePayments: ((outcome: PaymentOutcome) => void) | undefined;
    const late = new Promise<PaymentOutcome>((resolve) => {
      resolvePayments = resolve;
    });
    api.payments.mockImplementationOnce(() => late);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/backoffice/banking/transactions/${bankId}`, BankReconciliation);
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
    const component = await harness.navigateByUrl(
      `/backoffice/banking/transactions/${bankId}?sort=amount-desc&q=reglement&account=MAIN`,
      BankReconciliation,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    const allocations = root.querySelector<HTMLElement>(
      'section[aria-labelledby="allocations-title"]',
    );
    const history = root.querySelector<HTMLElement>('section[aria-labelledby="history-title"]');
    if (!allocations || !history) throw new Error('bank.test.table_missing');
    const transaction = structuredClone(component['transaction']());
    const historyRows = structuredClone(component['history']());
    expect(component['allocationSort']()).toBe('none');
    expect(component['historySort']()).toBe('none');
    expect(component['sortedAllocations']().map((row) => row.matchId)).toEqual([
      bankId,
      otherBankId,
    ]);
    expect(component['sortedHistory']().map((row) => row.id)).toEqual([otherBankId, bankId]);
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
    bankSortHeader(allocations, 'Commission :').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
      sort: 'amount-desc',
      q: 'reglement',
      account: 'MAIN',
      historySort: 'date-asc',
    });
    expect(bankSortHeader(allocations, 'Commission :').getAttribute('aria-sort')).toBe('none');
    expect(component['sortedAllocations']().map((row) => row.matchId)).toEqual([
      bankId,
      otherBankId,
    ]);
    bankSortHeader(history, 'Règlement associé').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toContain('historySort=date-desc');
    bankSortHeader(history, 'Règlement associé').querySelector('button')?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).parseUrl(TestBed.inject(Router).url).queryParams).toEqual({
      sort: 'amount-desc',
      q: 'reglement',
      account: 'MAIN',
    });
    expect(bankSortHeader(history, 'Règlement associé').getAttribute('aria-sort')).toBe('none');
    expect(component['sortedHistory']().map((row) => row.id)).toEqual([otherBankId, bankId]);
    expect(component['transaction']()).toEqual(transaction);
    expect(component['history']()).toEqual(historyRows);
    expect(allocations.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      'Motif conservé',
    );
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.history).toHaveBeenCalledTimes(1);
    expect(confirmation.request).not.toHaveBeenCalled();
    expect(root.querySelector('a[pageBack]')?.getAttribute('href')).toContain('sort=amount-desc');
  });
});
