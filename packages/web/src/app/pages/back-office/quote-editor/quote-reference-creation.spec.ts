import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type CatalogItemValue, type QuoteConditionPresetValue } from '@froment/contracts';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { CatalogApi } from '@backoffice/catalog-api';
import { ClientsApi } from '@backoffice/clients-api';
import { QuotesApi } from '@backoffice/quotes-api';
import { QuoteConditionPresetsApi } from '@backoffice/quote-condition-presets-api';
import { Confirmation } from '@shared/confirmation/confirmation';
import { CatalogEditor } from '../catalog-editor/catalog-editor';
import { ConditionEditor } from '../quote-condition-presets/condition-editor';
import { quoteFixture as savedQuote } from '../quote-detail/commercial.spec-helper';
import { QuoteEditor } from './quote-editor';

const item: CatalogItemValue = {
  id: savedQuote.id,
  description: 'Audit',
  quantityMilli: 1125,
  unitPriceCents: 12501,
  vatRateBasisPoints: 550,
  currency: 'EUR',
  version: 1,
  archived: false,
};
const preset: QuoteConditionPresetValue = {
  id: savedQuote.id,
  name: 'Payment',
  conditions: 'Within 30 days',
};

async function configure() {
  const closed = new Subject<CatalogItemValue | QuoteConditionPresetValue | undefined>();
  const dialog = {
    closed,
    backdropClick: new Subject<MouseEvent>(),
    keydownEvents: new Subject<KeyboardEvent>(),
    close: vi.fn((result?: CatalogItemValue | QuoteConditionPresetValue) => {
      closed.next(result);
      closed.complete();
    }),
  };
  const catalog = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ success: true, result: item }),
  };
  const conditions = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ success: true, result: preset }),
  };
  const quotes = { create: vi.fn(), createRevision: vi.fn() };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: CatalogApi, useValue: catalog },
      { provide: QuoteConditionPresetsApi, useValue: conditions },
      { provide: QuotesApi, useValue: quotes },
      { provide: ClientsApi, useValue: { list: async () => [] } },
      { provide: Confirmation, useValue: confirmation },
      { provide: Dialog, useValue: { open: vi.fn().mockReturnValue(dialog) } },
      { provide: DialogRef, useValue: dialog },
    ],
  });
  for (const component of [QuoteEditor, CatalogEditor, ConditionEditor]) {
    TestBed.overrideComponent(component, { set: { template: '', imports: [] } });
  }
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
  const fixture = TestBed.createComponent(QuoteEditor);
  await fixture.whenStable();
  const quote = fixture.componentInstance;
  quote['quoteForm'].title().value.set('Unsaved quote');
  quote['quoteForm'].conditions().value.set('Original terms');
  quote['quoteForm']().markAsDirty();
  return { fixture, quote, catalog, conditions, quotes, dialog, confirmation, navigate };
}

describe('Quote reference creation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('persists catalog values and adds a line without saving or replacing the quote draft', async () => {
    const { fixture, quote, catalog, quotes, navigate } = await configure();
    const original = quote['quoteForm']().value();
    quote['createCatalogItem']();
    const editorFixture = TestBed.createComponent(CatalogEditor);
    const editor = editorFixture.componentInstance;
    editor['itemForm'].description().value.set(' Audit ');
    editor['itemForm'].quantity().value.set('1,125');
    editor['itemForm'].unitPrice().value.set('125,01');
    editor['itemForm'].vatRate().value.set('5,50');
    editor['save'](new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(catalog.create).toHaveBeenCalledExactlyOnceWith({
      description: 'Audit',
      quantityMilli: 1125,
      unitPriceCents: 12501,
      vatRateBasisPoints: 550,
      currency: 'EUR',
    });
    expect(quote['quoteForm']().value()).toMatchObject({
      ...original,
      lines: [
        ...original.lines,
        { description: 'Audit', quantity: '1.125', unitPrice: '125.01', vatRate: '5.50' },
      ],
    });
    expect(quote['quoteForm']().dirty()).toBe(true);
    expect(quotes.create).not.toHaveBeenCalled();
    expect(quotes.createRevision).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps a created template when replacement is declined, then applies it without creating it again', async () => {
    const { fixture, quote, conditions, confirmation, navigate } = await configure();
    quote['createConditionPreset']();
    const editorFixture = TestBed.createComponent(ConditionEditor);
    const editor = editorFixture.componentInstance;
    editor['presetForm']().value.set({ name: ' Payment ', conditions: preset.conditions });
    editor['save'](new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(conditions.create).toHaveBeenCalledExactlyOnceWith({
      name: 'Payment',
      conditions: preset.conditions,
    });
    expect(quote['quoteForm'].conditions().value()).toBe('Original terms');
    expect(quote['conditionPresets']()).toEqual([preset]);
    confirmation.request.mockResolvedValue(true);
    await quote['selectConditionPreset'](preset.id);
    expect(quote['quoteForm'].conditions().value()).toBe(preset.conditions);
    expect(conditions.create).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('blocks closing, quote saving and duplicate creation while the catalog request is pending', async () => {
    const { fixture, quote, catalog, dialog, quotes } = await configure();
    let finish!: (result: { success: true; result: CatalogItemValue }) => void;
    catalog.create.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    quote['createCatalogItem']();
    const editorFixture = TestBed.createComponent(CatalogEditor);
    const editor = editorFixture.componentInstance;
    editor['itemForm'].description().value.set('Audit');
    editor['save'](new SubmitEvent('submit'));
    editor['save'](new SubmitEvent('submit'));
    quote['save'](new SubmitEvent('submit'));
    await editor['close']();
    expect(await quote.canDeactivate()).toBe(false);
    expect(await editor.canDeactivate()).toBe(false);
    expect(dialog.close).not.toHaveBeenCalled();
    expect(catalog.create).toHaveBeenCalledTimes(1);
    expect(quotes.create).not.toHaveBeenCalled();
    finish({ success: true, result: item });
    await fixture.whenStable();
    expect(dialog.close).toHaveBeenCalledWith(item);
  });

  it('keeps uncertain creation locked and refreshes available templates after confirmed closure', async () => {
    const { fixture, quote, conditions, dialog, confirmation } = await configure();
    conditions.create.mockResolvedValue({ success: false, code: 'quote.error' });
    quote['createConditionPreset']();
    const editorFixture = TestBed.createComponent(ConditionEditor);
    const editor = editorFixture.componentInstance;
    editor['presetForm']().value.set({ name: preset.name, conditions: preset.conditions });
    editor['presetForm']().markAsDirty();
    editor['save'](new SubmitEvent('submit'));
    await fixture.whenStable();
    editor['save'](new SubmitEvent('submit'));
    await editor['close']();
    expect(dialog.close).not.toHaveBeenCalled();
    expect(conditions.create).toHaveBeenCalledTimes(1);
    expect(editor['presetForm']().value()).toEqual({
      name: preset.name,
      conditions: preset.conditions,
    });
    conditions.list.mockResolvedValue([preset]);
    confirmation.request.mockResolvedValue(true);
    await editor['close']();
    await fixture.whenStable();
    expect(quote['conditionPresets']()).toEqual([preset]);
    expect(quote['quoteForm'].conditions().value()).toBe('Original terms');
  });
});
