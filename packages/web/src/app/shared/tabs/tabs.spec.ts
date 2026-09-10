import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Tabs, type TabItem } from './tabs';

@Component({
  imports: [Tabs],
  template: `
    <app-tabs
      label="Sections"
      [tabs]="tabs"
      [disabled]="disabled()"
      [preserveQuery]="preserveQuery()"
    />
    <section id="first-panel" role="region" aria-labelledby="first-tab"></section>
    <section id="second-panel" role="region" aria-labelledby="second-tab"></section>
  `,
})
class TestHost {
  readonly disabled = signal(false);
  readonly preserveQuery = signal(false);
  readonly tabs: readonly TabItem[] = [
    { path: 'first', id: 'first-tab', label: 'First' },
    { path: 'second', id: 'second-tab', label: 'Second' },
  ];
}

@Component({ template: '' })
class TestPage {}

describe('Tabs', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'first', component: TestPage },
          { path: 'first/child', component: TestPage },
          { path: 'second', component: TestPage },
        ]),
      ],
    });
  });

  it('navigates with relative links and marks the current page', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first');
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const links = root.querySelectorAll<HTMLAnchorElement>('a');

    links[1]?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/second');
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
  });

  it.each(['click', 'auxclick'])(
    'blocks %s while pending without losing the current page or focus',
    async (eventName) => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/first');
      const fixture = TestBed.createComponent(TestHost);
      fixture.componentInstance.disabled.set(true);
      await fixture.whenStable();
      const root: HTMLElement = fixture.nativeElement;
      const link = root.querySelector<HTMLAnchorElement>('#second-tab');
      const event = new MouseEvent(eventName, { bubbles: true, cancelable: true });

      link?.focus();
      link?.dispatchEvent(event);
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(router.url).toBe('/first');
      expect(link?.getAttribute('aria-disabled')).toBe('true');
      expect(document.activeElement).toBe(link);
      expect(root.querySelector('#first-tab')?.getAttribute('aria-current')).toBe('page');
    },
  );

  it('preserves query parameters when requested', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first?q=angular');
    const fixture = TestBed.createComponent(TestHost);
    fixture.componentInstance.preserveQuery.set(true);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    root.querySelector<HTMLAnchorElement>('#second-tab')?.click();
    await fixture.whenStable();

    expect(router.url).toBe('/second?q=angular');
  });

  it('matches child routes only when exact matching is disabled', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first/child');
    const fixture = TestBed.createComponent(Tabs);
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('tabs', [{ path: '/first', id: 'first-tab', label: 'First' }]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('#first-tab')?.hasAttribute('aria-current')).toBe(false);

    fixture.componentRef.setInput('tabs', [
      { path: '/first', id: 'first-tab', label: 'First', exact: false },
    ]);
    await fixture.whenStable();

    expect(root.querySelector('#first-tab')?.getAttribute('aria-current')).toBe('page');
  });

  it('preserves the fragment when requested', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first#quote-token');
    const fixture = TestBed.createComponent(Tabs);
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('preserveFragment', true);
    fixture.componentRef.setInput('tabs', [
      { path: '/second', id: 'document-tab', label: 'Document' },
    ]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    root.querySelector<HTMLAnchorElement>('#document-tab')?.click();
    await fixture.whenStable();

    expect(router.url).toBe('/second#quote-token');
  });

  it('merges item queries and matches the selected query', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first?q=angular&tab=summary');
    const fixture = TestBed.createComponent(Tabs);
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('preserveQuery', true);
    fixture.componentRef.setInput('tabs', [
      { path: '/first', id: 'summary-tab', label: 'Summary', queryParams: { tab: 'summary' } },
      { path: '/first', id: 'document-tab', label: 'Document', queryParams: { tab: 'document' } },
    ]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    root.querySelector<HTMLAnchorElement>('#document-tab')?.click();
    await fixture.whenStable();

    expect(router.parseUrl(router.url).queryParams).toEqual({ q: 'angular', tab: 'document' });
    expect(root.querySelector('#document-tab')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('#summary-tab')?.hasAttribute('aria-current')).toBe(false);
  });

  it('uses explicit selection for a default view without a query parameter', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first');
    const fixture = TestBed.createComponent(Tabs);
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('tabs', [
      {
        path: '/first',
        id: 'summary-tab',
        label: 'Summary',
        queryParams: { tab: 'summary' },
        active: true,
      },
      { path: '/first', id: 'document-tab', label: 'Document', active: false },
    ]);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('#summary-tab')?.getAttribute('aria-current')).toBe('page');
    expect(root.querySelector('#document-tab')?.hasAttribute('aria-current')).toBe(false);
  });

  it('marks the current route independently of its query', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/first?q=angular');
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#first-tab')?.getAttribute('aria-current')).toBe(
      'page',
    );
    await router.navigateByUrl('/first?q=audit');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#first-tab')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
