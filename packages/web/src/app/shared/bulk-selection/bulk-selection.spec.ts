import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BulkSelection } from './bulk-selection';

@Component({
  imports: [BulkSelection],
  template: `<app-bulk-selection
    [count]="count()"
    selectionLabel="Selected: 2"
    clearLabel="Clear selection"
    (clearSelection)="count.set(0)"
  >
    <button type="button" (click)="action()">Mark ready</button>
  </app-bulk-selection>`,
})
class BulkHost {
  readonly count = signal(0);
  readonly action = vi.fn();
}

describe('BulkSelection', () => {
  it('appears only with selection and preserves caller-owned actions', async () => {
    const fixture = TestBed.createComponent(BulkHost);
    await fixture.whenStable();
    const bar: HTMLElement = fixture.nativeElement.querySelector('app-bulk-selection');
    expect(bar.hidden).toBe(true);
    fixture.componentInstance.count.set(2);
    await fixture.whenStable();
    expect(bar.hidden).toBe(false);
    const buttons = bar.querySelectorAll('button');
    buttons[0].click();
    expect(fixture.componentInstance.action).toHaveBeenCalledOnce();
    buttons[1].click();
    await fixture.whenStable();
    expect(bar.hidden).toBe(true);
  });
});
