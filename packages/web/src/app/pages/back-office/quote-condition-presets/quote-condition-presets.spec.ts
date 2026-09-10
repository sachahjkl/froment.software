import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { ConditionEditor } from './condition-editor';
import { QuoteConditionPresets } from './quote-condition-presets';

describe('QuoteConditionPresets', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps conditions searchable without inventing status or date filters', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: QuoteConditionPresetsApi,
          useValue: { list: async () => [] },
        },
      ],
    });
    const fixture = TestBed.createComponent(QuoteConditionPresets);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('app-list-search')).not.toBeNull();
    expect(root.querySelector('app-filter-menu')).toBeNull();
    expect(root.querySelector('app-date-range-filter')).toBeNull();
  });

  it('keeps validated list context after a successful edit', async () => {
    const preset = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      name: 'Payment',
      conditions: 'Within 30 days',
    };
    const update = vi.fn().mockResolvedValue({ success: true, result: preset });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ presetId: preset.id }) },
            queryParamMap: of(
              convertToParamMap({
                q: 'Payment',
                sort: 'conditionsDesc',
                filter: 'invented',
                unrelated: 'discard',
              }),
            ),
          },
        },
        { provide: QuoteConditionPresetsApi, useValue: { list: async () => [preset], update } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ConditionEditor);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('a')?.getAttribute('href')).toContain('sort=conditionsDesc');
    fixture.componentInstance['save'](new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(update).toHaveBeenCalledWith(preset.id, {
      name: preset.name,
      conditions: preset.conditions,
    });
    expect(navigate).toHaveBeenLastCalledWith(['/backoffice/configuration/conditions'], {
      queryParams: { q: 'Payment', sort: 'conditionsDesc' },
    });
  });
  it('keeps the error and edited values when saving fails', async () => {
    const list = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({
      success: false,
      code: 'quote.error',
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuoteConditionPresetsApi, useValue: { list, create } },
      ],
    });
    const fixture = TestBed.createComponent(ConditionEditor);
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
    const fixture = TestBed.createComponent(ConditionEditor);
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
