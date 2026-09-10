import { RouterTestingHarness } from '@angular/router/testing';
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

describe('Ledger reversal task', () => {
  it('rejects dates before the entry and preserves the reason and request key after an uncertain response', async () => {
    const { ledger } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
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
