import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { BankLedgerApi } from '@backoffice/bank-ledger-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { BankLedger } from './bank-ledger';

const source = {
  sourceId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
  sourceKind: 'debit' as const,
  reference: 'D-1',
  account: 'BANK',
  bookedOn: '2026-09-01',
  amountCents: 1234,
  entryId: null,
};
describe('BankLedger', () => {
  afterEach(() => vi.restoreAllMocks());
  it('preserves inputs and the request key after failure and guards unsaved changes', async () => {
    const post = vi.fn(async () => ({ success: false, code: 'ledger.conflict' }));
    const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: BankLedgerApi,
          useValue: {
            list: async () => ({ success: true, result: { entries: [], sources: [source] } }),
            post,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(BankLedger);
    await fixture.whenStable();
    await fixture.componentInstance['select'](source);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const fields = root.querySelectorAll<HTMLInputElement>('.entry-form input');
    for (const [index, value] of ['627', '512', '<script>Fee</script>'].entries()) {
      const field = fields[index];
      if (!field) throw new Error('ledger.test.field_missing');
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await fixture.whenStable();
    confirmation.mockResolvedValue(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    const send = async () => {
      root
        .querySelector('.entry-form')
        ?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
    };
    await send();
    expect(post).not.toHaveBeenCalled();
    confirmation.mockResolvedValue(true);
    await send();
    await send();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
    expect(fields[2]?.value).toBe('<script>Fee</script>');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
});
