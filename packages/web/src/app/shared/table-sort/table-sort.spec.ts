import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { TableSort } from './table-sort';
import { nextTableSort } from './sort-state';

describe('TableSort', () => {
  it('announces the next sort direction with the column name', async () => {
    const fixture = TestBed.createComponent(TableSort);
    TestBed.inject(I18nService).setLanguage('en');
    fixture.componentRef.setInput('label', 'Price');
    fixture.componentRef.setInput('direction', 'ascending');
    await fixture.whenStable();
    expect(fixture.nativeElement.getAttribute('type')).toBe('button');
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Price: sort descending');
    fixture.componentRef.setInput('direction', 'descending');
    await fixture.whenStable();
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Price: restore initial order');
    expect(fixture.nativeElement.getAttribute('title')).toBe('Price: restore initial order');
    expect(fixture.nativeElement.querySelector('[aria-hidden="true"]').textContent).toBe('↓');
    fixture.componentRef.setInput('direction', 'none');
    await fixture.whenStable();
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Price: sort ascending');
    expect(fixture.nativeElement.querySelector('[aria-hidden="true"]').textContent).toBe('↕');
  });

  it('cycles through ascending, descending and initial order', () => {
    const ascending = nextTableSort('none', 'amount-asc', 'amount-desc');
    const descending = nextTableSort(ascending, 'amount-asc', 'amount-desc');
    const reset = nextTableSort(descending, 'amount-asc', 'amount-desc');
    expect([ascending, descending, reset]).toEqual(['amount-asc', 'amount-desc', 'none']);
    expect(nextTableSort(reset, 'amount-asc', 'amount-desc')).toBe('amount-asc');
    expect(nextTableSort('date-desc', 'amount-asc', 'amount-desc')).toBe('amount-asc');
  });
});
