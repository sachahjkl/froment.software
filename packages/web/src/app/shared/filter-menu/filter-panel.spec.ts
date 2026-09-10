import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilterPanel } from './filter-panel';

@Component({
  imports: [FilterPanel],
  template:
    '<ng-template appFilterPanel label="Période" [summary]="summary()"><input type="date" /></ng-template>',
})
class PanelExample {
  readonly summary = signal('Septembre');
  readonly panel = viewChild.required(FilterPanel);
}

describe('FilterPanel', () => {
  it('exposes its label, summary, and lazy template without rendering a second panel', async () => {
    const fixture = TestBed.createComponent(PanelExample);
    await fixture.whenStable();
    const panel = fixture.componentInstance.panel();
    expect(panel.label()).toBe('Période');
    expect(panel.summary()).toBe('Septembre');
    expect(panel.template).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    fixture.componentInstance.summary.set('Octobre');
    await fixture.whenStable();
    expect(panel.summary()).toBe('Octobre');
  });
});
