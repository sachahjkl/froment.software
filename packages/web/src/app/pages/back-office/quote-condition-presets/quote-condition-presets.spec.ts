import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { ConditionEditor } from './condition-editor';
import { QuoteConditionPresets } from './quote-condition-presets';

describe('QuoteConditionPresets', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideAccount()] }));
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

  it('confirms deletion, blocks pending exits and refreshes the list and export', async () => {
    const preset = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      name: 'Payment',
      conditions: 'Within 30 days',
    };
    const list = vi.fn().mockResolvedValue([preset]);
    let finish!: (result: { success: true; result: typeof preset }) => void;
    const remove = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const request = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuoteConditionPresetsApi, useValue: { list, remove } },
        { provide: Confirmation, useValue: { request } },
      ],
    });
    TestBed.overrideComponent(QuoteConditionPresets, { set: { template: '', imports: [] } });
    const fixture = TestBed.createComponent(QuoteConditionPresets);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const loadedPreset = component['presets']()[0]!;
    expect(component['conditionExport']()).toEqual([[preset.name, preset.conditions]]);
    expect(component.canDeactivate()).toBe(true);
    await component['remove'](loadedPreset);
    expect(remove).not.toHaveBeenCalled();
    request.mockResolvedValue(true);
    const pending = component['remove'](loadedPreset);
    await vi.waitFor(() => expect(remove).toHaveBeenCalledExactlyOnceWith(preset.id));
    expect(component.canDeactivate()).toBe(false);
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    list.mockResolvedValue([]);
    finish({ success: true, result: preset });
    await pending;
    expect(component['presets']()).toEqual([]);
    expect(component['conditionExport']()).toEqual([]);
    expect(component.canDeactivate()).toBe(true);
    const idleUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(idleUnload);
    expect(idleUnload.defaultPrevented).toBe(false);
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
            snapshot: {
              paramMap: convertToParamMap({ presetId: preset.id }),
              queryParamMap: convertToParamMap({
                q: 'Payment',
                sort: 'conditionsDesc',
                filter: 'invented',
                unrelated: 'discard',
              }),
            },
            paramMap: of(convertToParamMap({ presetId: preset.id })),
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
    expect(
      root.querySelector('a[href^="/backoffice/configuration/conditions?"]')?.getAttribute('href'),
    ).toContain('sort=conditionsDesc');
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

    name.value = 'Payment';
    name.dispatchEvent(new Event('input'));
    fixture.componentInstance['presetForm'].conditions().value.set('Within 30 days');
    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(create).toHaveBeenCalled();
    expect(fixture.componentInstance['error']()).toBe('referenceEditor.conditionsUncertain');
    expect(name.value).toBe('Payment');
    expect(fixture.componentInstance['presetForm'].conditions().value()).toBe('Within 30 days');
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

  it('guards a placement change without changing the text', async () => {
    const request = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuoteConditionPresetsApi, useValue: { list: async () => [] } },
        { provide: Confirmation, useValue: { request } },
      ],
    });
    const fixture = TestBed.createComponent(ConditionEditor);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['setConditionsPresentation']({ format: 'markdown', placement: 'new-page' });
    await fixture.whenStable();
    expect(component['presetForm'].conditions().value()).toBe('');
    expect(await component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(request).toHaveBeenCalledOnce();
  });

  it('rejects unsupported formatting before sending a create request', async () => {
    const create = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: QuoteConditionPresetsApi, useValue: { list: async () => [], create } },
      ],
    });
    const fixture = TestBed.createComponent(ConditionEditor);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['model'].set({
      name: 'Conditions',
      conditions: '<b>Texte</b>',
      conditionsPresentation: { format: 'markdown', placement: 'inline' },
    });
    await fixture.whenStable();
    component['save'](new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(create).not.toHaveBeenCalled();
    expect(component['uncertain']()).toBe(false);
    expect(component['presetForm'].conditions().disabled()).toBe(false);
    component['presetForm'].conditions().value.set('Texte corrigé');
    await fixture.whenStable();
    expect(component['presetForm'].conditions().valid()).toBe(true);
  });
});
import { provideAccount } from '@backoffice/account.spec-helper';
