import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LedgerPost } from './ledger-post';
import {
  bankField,
  bankId,
  bankRoot,
  bankSubmit,
  ledgerEntry,
  setupBankWorkspace,
} from '../banking/bank-workspace.spec-helper';

describe('Ledger posting task', () => {
  it('validates distinct accounts, guards dirty edits and retries the same immutable request', async () => {
    const { ledger, confirmation } = setupBankWorkspace();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/backoffice/banque/ecritures/comptabiliser/debit/${bankId}`,
      LedgerPost,
    );
    await harness.fixture.whenStable();
    const root = bankRoot(harness);
    expect(ledger.getSource).toHaveBeenCalledWith('debit', bankId);
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('form input'));
    bankField(root, 'input[aria-describedby="debit-error"]', '627');
    bankField(root, 'input[aria-describedby="credit-error"]', '627');
    bankField(root, 'input[aria-describedby="label-error"]', '<script>Commission</script>');
    await harness.fixture.whenStable();
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(ledger.post).not.toHaveBeenCalled();
    expect(root.textContent).toContain('différent');
    bankField(root, 'input[aria-describedby="credit-error"]', '512');
    await harness.fixture.whenStable();
    confirmation.request.mockResolvedValue(false);
    await harness.navigateByUrl('/backoffice/banque/ecritures');
    expect(TestBed.inject(Router).url).toContain('/comptabiliser/');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    confirmation.request.mockResolvedValue(true);
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(ledger.post).toHaveBeenCalledTimes(1);
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(ledger.post.mock.calls[0]).toEqual(ledger.post.mock.calls[1]);
    expect(root.querySelector('script')).toBeNull();
    ledger.post.mockResolvedValue({ success: true, result: ledgerEntry });
    bankSubmit(root);
    await harness.fixture.whenStable();
    expect(root.textContent).toContain('Écriture enregistrée');
    expect(root.querySelector('form')).toBeNull();
  });
});
