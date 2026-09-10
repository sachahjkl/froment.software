import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListToolbar } from './list-toolbar';

@Component({
  imports: [ListToolbar],
  template: `
    <app-list-toolbar>
      <label listSearch>Search<input type="search" /></label>
      <button listFilters type="button">Filters</button>
      <button listActions type="button">Export</button>
      <p listSummary role="status">3 results</p>
    </app-list-toolbar>
  `,
})
class ToolbarExample {}

@Component({
  imports: [ListToolbar],
  template: '<app-list-toolbar><label>Status<select></select></label></app-list-toolbar>',
})
class ProjectedControlsExample {}

describe('ListToolbar', () => {
  it('keeps separate projection slots on the same control row', async () => {
    const fixture = TestBed.createComponent(ToolbarExample);
    await fixture.whenStable();
    const toolbar = fixture.nativeElement.querySelector('app-list-toolbar') as HTMLElement;
    expect(toolbar.querySelector('.search [listSearch]')).not.toBeNull();
    expect(toolbar.querySelector('.filters [listFilters]')).not.toBeNull();
    expect(toolbar.querySelector('.actions [listActions]')).not.toBeNull();
    expect(toolbar.querySelector('.summary [listSummary]')?.textContent).toBe('3 results');
    expect(toolbar.querySelector('.controls [listSummary]')).not.toBeNull();
    expect(toolbar.children).toHaveLength(1);
  });

  it('projects unmarked controls without creating empty slot content', async () => {
    const fixture = TestBed.createComponent(ProjectedControlsExample);
    await fixture.whenStable();
    const toolbar = fixture.nativeElement.querySelector('app-list-toolbar') as HTMLElement;
    expect(toolbar.querySelector('.filters select')).not.toBeNull();
    expect(toolbar.querySelector('.search')?.children).toHaveLength(0);
    expect(toolbar.querySelector('.actions')?.children).toHaveLength(0);
    expect(toolbar.querySelector('.summary')?.children).toHaveLength(0);
  });
});
