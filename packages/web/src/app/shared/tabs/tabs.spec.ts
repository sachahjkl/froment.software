import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Tabs } from './tabs';

@Component({
  imports: [Tabs],
  template: `
    <app-tabs label="Sections" [tabs]="tabs" />
    <section id="first-panel" role="region" aria-labelledby="first-tab"></section>
    <section id="second-panel" role="region" aria-labelledby="second-tab"></section>
  `,
})
class TestHost {
  readonly tabs = [
    { path: 'first', id: 'first-tab', label: 'First' },
    { path: 'second', id: 'second-tab', label: 'Second' },
  ];
}

@Component({
  imports: [Tabs],
  template: `<app-tabs label="Sections" [tabs]="tabs" [disabled]="true" />`,
})
class DisabledHost {
  readonly tabs = [{ path: 'first', id: 'disabled-first-tab', label: 'First' }];
}

describe('Tabs', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'first', component: DisabledHost },
          { path: 'second', component: DisabledHost },
        ]),
      ],
    });
  });

  it('navigates with relative links and marks the current page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first');
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const links = root.querySelectorAll<HTMLAnchorElement>('a');

    links[1]?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/second');
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
  });

  it('disables every tab when interaction is pending', () => {
    const fixture = TestBed.createComponent(DisabledHost);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const link = root.querySelector<HTMLAnchorElement>('a');
    link?.click();
    expect(TestBed.inject(Router).url).not.toBe('/first');
  });
});
