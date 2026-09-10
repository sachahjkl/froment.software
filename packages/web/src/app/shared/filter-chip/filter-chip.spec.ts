import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { FilterChip } from './filter-chip';

describe('FilterChip', () => {
  it('names both the filter and its removal action', async () => {
    const fixture = TestBed.createComponent(FilterChip);
    TestBed.inject(I18nService).setLanguage('en');
    fixture.componentRef.setInput('label', 'Search: Angular');
    await fixture.whenStable();
    expect(fixture.nativeElement.getAttribute('type')).toBe('button');
    expect(fixture.nativeElement.getAttribute('aria-label')).toBe('Remove filter Search: Angular');
    expect(fixture.nativeElement.textContent).toContain('Search: Angular');
  });
});
