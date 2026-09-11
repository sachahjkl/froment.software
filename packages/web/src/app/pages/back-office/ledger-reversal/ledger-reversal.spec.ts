import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { LedgerReversal } from './ledger-reversal';
import {
  bankField,
  bankId,
  bankRoot,
  bankSubmit,
  ledgerEntry,
  otherBankId,
  setupBankWorkspace,
} from '../banking/bank-workspace.spec-helper';

function notifyDateValidity(input: HTMLInputElement, animationName = 'ng-invalid'): void {
  const event = new Event('animationstart');
  Object.defineProperty(event, 'animationName', { value: animationName });
  input.dispatchEvent(event);
}

describe('Ledger reversal task', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
  afterEach(() => vi.restoreAllMocks());
  it('keeps an entry readable without offering reversal instructions', async () => {
    setupBankWorkspace();
    TestBed.configureTestingModule({ providers: [provideAccount(['ledger.read'])] });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(
      `/backoffice/banque/ecritures/${otherBankId}/contrepasser`,
      LedgerReversal,
    );
    await harness.fixture.whenStable();
    expect(page['state']()).toBe('ready');
    expect(page['titleLabel']()).toBe('bankWorkspace.entries');
    expect(bankRoot(harness).querySelector('form')).toBeNull();
  });
  it.each(['ng-valid', 'ng-invalid'])(
    'leaves an unchanged form after its %s animation without confirmation',
    async (animationName) => {
      const { ledger, confirmation } = setupBankWorkspace();
      confirmation.request.mockResolvedValue(false);
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(
        `/backoffice/banque/ecritures/${otherBankId}/contrepasser`,
        LedgerReversal,
      );
      await harness.fixture.whenStable();
      const root = bankRoot(harness);
      const loaded = component['reversalForm']().value();
      notifyDateValidity(
        root.querySelector<HTMLInputElement>('input[type="date"]')!,
        animationName,
      );
      await harness.fixture.whenStable();
      expect(component['reversalForm'].bookedOn().dirty()).toBe(true);
      expect(component['reversalForm']().touched()).toBe(false);
      expect(component['reversalForm']().value()).toEqual(loaded);
      expect(component['hasUnsavedChanges']()).toBe(false);
      expect(await component.canDeactivate()).toBe(true);
      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(false);
      bankSubmit(root);
      await harness.fixture.whenStable();
      expect(ledger.reverse).not.toHaveBeenCalled();
      await harness.navigateByUrl('/backoffice/banque/ecritures');
      expect(TestBed.inject(Router).url).toBe('/backoffice/banque/ecritures');
      expect(confirmation.request).not.toHaveBeenCalled();
    },
  );
  it('keeps actual edits after declined navigation or refresh and accepts reverted values', async () => {
    const { ledger, confirmation } = setupBankWorkspace();
    confirmation.request.mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    const path = `/backoffice/banque/ecritures/${otherBankId}/contrepasser`;
    const component = await harness.navigateByUrl(path, LedgerReversal);
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, 'textarea', 'Retained reason');
    await harness.fixture.whenStable();
    await harness.navigateByUrl('/backoffice/banque/ecritures');
    expect(TestBed.inject(Router).url).toBe(path);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await component['refresh']();
    expect(ledger.getEntry).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('Retained reason');
    expect(component['reversalForm'].reason().value()).toBe('Retained reason');
    bankField(root, 'textarea', '');
    await harness.fixture.whenStable();
    expect(component['reversalForm']().dirty()).toBe(true);
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(true);
    const revertedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(revertedUnload);
    expect(revertedUnload.defaultPrevented).toBe(false);
    expect(confirmation.request).toHaveBeenCalledTimes(2);
  });
  it('protects incomplete native input without a model change and rejects its submission', async () => {
    const { ledger, confirmation } = setupBankWorkspace();
    confirmation.request.mockResolvedValue(false);
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      `/backoffice/banque/ecritures/${otherBankId}/contrepasser`,
      LedgerReversal,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    const form = component['reversalForm'];
    const loaded = form().value();
    const date = root.querySelector<HTMLInputElement>('input[type="date"]')!;
    const badInput = vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(form().value()).toEqual(loaded);
    expect(form().dirty()).toBe(false);
    expect(form.bookedOn().errors()).toContainEqual(expect.objectContaining({ kind: 'parse' }));
    expect(component['hasUnsavedChanges']()).toBe(true);
    expect(await component.canDeactivate()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    badInput.mockRestore();
    notifyDateValidity(date);
    await harness.fixture.whenStable();
    expect(component['hasUnsavedChanges']()).toBe(false);
    expect(await component.canDeactivate()).toBe(true);
    bankField(root, 'textarea', 'Wrong account');
    bankField(root, 'input[type="date"]', '2026-09-01');
    vi.spyOn(date.validity, 'badInput', 'get').mockReturnValue(true);
    date.dispatchEvent(new Event('input', { bubbles: true }));
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(form.bookedOn().value()).toBe('2026-09-01');
    expect(document.activeElement).toBe(date);
    expect(ledger.reverse).not.toHaveBeenCalled();
    expect(confirmation.request).toHaveBeenCalledTimes(1);
  });
  it('rejects dates before the entry and preserves the reason and request key after an uncertain response', async () => {
    const { ledger, confirmation } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      `/backoffice/banque/ecritures/${otherBankId}/contrepasser`,
      LedgerReversal,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, 'textarea', 'Mauvais compte');
    bankField(root, 'input[type="date"]', '2026-08-31');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(ledger.reverse).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(root.querySelector('input[type="date"]'));
    bankField(root, 'input[type="date"]', '2026-09-01');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(component['pending']()).toBeDefined();
    expect(component['reversalForm']().dirty()).toBe(false);
    expect(root.querySelector<HTMLInputElement>('input[type="date"]')!.disabled).toBe(true);
    confirmation.request.mockResolvedValue(false);
    expect(await component.canDeactivate()).toBe(false);
    const uncertainUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(uncertainUnload);
    expect(uncertainUnload.defaultPrevented).toBe(true);
    await component['refresh']();
    expect(ledger.getEntry).toHaveBeenCalledTimes(1);
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(ledger.reverse.mock.calls[0]).toEqual(ledger.reverse.mock.calls[1]);
    expect(ledger.reverse).toHaveBeenCalledWith(otherBankId, {
      reason: 'Mauvais compte',
      bookedOn: '2026-09-01',
      requestId: expect.any(String),
    });
    ledger.reverse.mockResolvedValue({
      success: true,
      result: {
        ...ledgerEntry,
        id: bankId,
        reversesId: otherBankId,
        debitAccount: '512',
        creditAccount: '627',
        label: 'Mauvais compte',
      },
    });
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.textContent).toContain('Contrepassée par');
    expect(await component.canDeactivate()).toBe(true);
    const completedUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(completedUnload);
    expect(completedUnload.defaultPrevented).toBe(false);
    component['reverse'](new SubmitEvent('submit'));
    expect(ledger.reverse).toHaveBeenCalledTimes(3);
  });
  it('blocks navigation and duplicate reversal while its request is in flight', async () => {
    const { ledger, confirmation } = setupBankWorkspace();
    let resolve: ((outcome: Awaited<ReturnType<typeof ledger.reverse>>) => void) | undefined;
    const response = new Promise<Awaited<ReturnType<typeof ledger.reverse>>>((complete) => {
      resolve = complete;
    });
    ledger.reverse.mockReturnValueOnce(response);
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(
      `/backoffice/banque/ecritures/${otherBankId}/contrepasser`,
      LedgerReversal,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    bankField(root, 'textarea', 'Wrong account');
    bankField(root, 'input[type="date"]', '2026-09-01');
    bankSubmit(root);
    try {
      await vi.waitFor(() => expect(ledger.reverse).toHaveBeenCalledTimes(1));
      await vi.waitFor(() =>
        expect(root.querySelector<HTMLInputElement>('input[type="date"]')!.disabled).toBe(true),
      );
      expect(component['busy']()).toBe(true);
      expect(await component.canDeactivate()).toBe(false);
      const unload = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(unload);
      expect(unload.defaultPrevented).toBe(true);
      bankSubmit(root);
      expect(ledger.reverse).toHaveBeenCalledTimes(1);
      expect(confirmation.request).toHaveBeenCalledTimes(1);
    } finally {
      resolve?.({ success: false, code: 'ledger.error' });
    }
    await response;
    await harness.fixture.whenStable();
    expect(component['busy']()).toBe(false);
    expect(component['pending']()).toBeDefined();
  });
  it('opens preserved related entries independently of the current period', async () => {
    const { ledger } = setupBankWorkspace();
    ledger.getEntry.mockResolvedValue({
      success: true,
      result: { ...ledgerEntry, reversalId: bankId },
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/backoffice/banque/ecritures/${otherBankId}/contrepasser?from=2020-01-01&to=2020-12-31`,
      LedgerReversal,
    );
    await harness.fixture.whenStable();
    expect(ledger.getEntry).toHaveBeenCalledWith(otherBankId);
    expect(ledger.list).not.toHaveBeenCalled();
    expect(bankRoot(harness).querySelector('form')).toBeNull();
    expect(bankRoot(harness).querySelector(`a[href*="${bankId}/contrepasser"]`)).not.toBeNull();
  });
});
import { provideAccount } from '@backoffice/account.spec-helper';
