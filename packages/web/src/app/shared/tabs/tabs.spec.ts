import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Tabs } from './tabs';

@Component({
  imports: [Tabs],
  template: `
    <app-tabs label="Sections" [tabs]="tabs" queryParam="section" [(selected)]="selected" />
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

@Component({
  imports: [Tabs],
  template: `<app-tabs label="Sections" [tabs]="tabs" selected="first" [disabled]="true" />`,
})
class DisabledHost {
  readonly tabs = [
    { value: 'first', id: 'disabled-first-tab', label: 'First', panelId: 'first-panel' },
  ];
}

describe('Tabs', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('selects tabs and supports arrow navigation', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    buttons[1]?.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('second');
    expect(buttons[1]?.getAttribute('aria-selected')).toBe('true');
    expect(router.url).toBe('/?section=second');

    buttons[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBe('first');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('restores the selected tab from the query parameter', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?section=second');
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.selected()).toBe('second');
  });

  it('disables every tab when interaction is pending', () => {
    const fixture = TestBed.createComponent(DisabledHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector<HTMLButtonElement>('button');
    expect(button?.disabled).toBe(true);
  });
});
