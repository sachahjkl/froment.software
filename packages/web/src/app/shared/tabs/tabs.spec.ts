import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { Tabs } from './tabs';

@Component({
  imports: [Tabs],
  template: `
    <app-tabs label="Sections" [tabs]="tabs" [(selected)]="selected" />
    <section id="first-panel" role="tabpanel" aria-labelledby="first-tab"></section>
    <section id="second-panel" role="tabpanel" aria-labelledby="second-tab"></section>
  `,
})
class TestHost {
  readonly selected = signal('first');
  readonly tabs = [
    { value: 'first', id: 'first-tab', label: 'First', panelId: 'first-panel' },
    { value: 'second', id: 'second-tab', label: 'Second', panelId: 'second-panel' },
  ];
}

describe('Tabs', () => {
  it('selects tabs and supports arrow navigation', async () => {
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    buttons[1]?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('second');
    expect(buttons[1]?.getAttribute('aria-selected')).toBe('true');

    buttons[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('first');
    expect(document.activeElement).toBe(buttons[0]);
  });
});
