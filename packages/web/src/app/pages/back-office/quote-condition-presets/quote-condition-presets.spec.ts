import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { QuoteConditionPresets } from './quote-condition-presets';

describe('QuoteConditionPresets', () => {
  it('keeps the reload error and edited values when saving succeeds but reload fails', async () => {
    const list = vi.fn().mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('offline'));
    const create = vi.fn().mockResolvedValue({
      success: true,
      result: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        name: 'Payment',
        conditions: 'Within 30 days',
      },
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuoteConditionPresetsApi, useValue: { list, create } },
      ],
    });
    const fixture = TestBed.createComponent(QuoteConditionPresets);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const name = root.querySelector<HTMLInputElement>('#preset-name')!;
    const conditions = root.querySelector<HTMLTextAreaElement>('#preset-conditions')!;

    name.value = 'Payment';
    name.dispatchEvent(new Event('input'));
    conditions.value = 'Within 30 days';
    conditions.dispatchEvent(new Event('input'));
    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(create).toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')?.textContent).toMatch(/devis|quote/i);
    expect(name.value).toBe('Payment');
    expect(conditions.value).toBe('Within 30 days');
  });

  it('describes invalid preset fields', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuoteConditionPresetsApi, useValue: { list: () => Promise.resolve([]) } },
      ],
    });
    const fixture = TestBed.createComponent(QuoteConditionPresets);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const name = root.querySelector<HTMLInputElement>('#preset-name')!;

    name.dispatchEvent(new Event('blur'));
    await fixture.whenStable();

    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toBe('preset-name-error');
    expect(root.querySelector('#preset-name-error')).not.toBeNull();
  });
});
