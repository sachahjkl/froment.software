import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { TableSort } from './table-sort';

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
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Price: sort ascending');
    expect(fixture.nativeElement.querySelector('[aria-hidden="true"]').textContent).toBe('↓');
  });
});
