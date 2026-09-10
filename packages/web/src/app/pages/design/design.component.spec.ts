import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { I18nService } from '@app/i18n.service';
import { installScrollIntoView } from '@shared/filter-choice/filter-choice.spec-helper';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesignComponent } from './design.component';
import { designRoutes } from './design.routes';
import { referenceCatalog } from './reference-catalog';

describe('Component reference', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [{ path: 'design', component: DesignComponent, children: designRoutes }],
          withComponentInputBinding(),
        ),
      ],
    });
  });
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    scrolling.restore();
    vi.restoreAllMocks();
  });

  async function setup(path = '/design') {
    const harness = await RouterTestingHarness.create(path);
    TestBed.inject(I18nService).setLanguage('fr');
    await harness.fixture.whenStable();
    const root = harness.routeNativeElement!;
    return { harness, root, router: TestBed.inject(Router) };
  }

  it('assigns every entry one lazy durable route without the old catalog tabs', async () => {
    const paths = designRoutes
      .filter((route) => route.path)
      .map((route) => route.path)
      .sort();
    expect(paths).toEqual(referenceCatalog.map((entry) => entry.id).sort());
    expect(new Set(paths).size).toBe(paths.length);
    expect(
      designRoutes
        .filter((route) => route.path)
        .every((route) => typeof route.loadComponent === 'function'),
    ).toBe(true);
    const { root, router } = await setup();
    expect(router.url).toBe('/design/button');
    expect(root.querySelectorAll('.reference-sidebar [data-reference-link]')).toHaveLength(
      referenceCatalog.length,
    );
    expect(root.querySelectorAll('.reference-sidebar nav > section')).toHaveLength(7);
    expect(root.querySelector('.proposal')).toBeNull();
    expect(root.querySelector('app-back-office-header, app-back-office-nav')).toBeNull();
    expect(
      root.querySelector('.reference-main > app-site-footer app-language-selector'),
    ).not.toBeNull();
    expect(root.querySelector('.reference-main > app-site-footer app-theme-toggle')).not.toBeNull();
  });

  for (const entry of referenceCatalog.filter((item) => item.id !== 'workflows')) {
    it(`renders ${entry.id}, its declared variants and its static API without HTTP`, async () => {
      const fetch = vi
        .spyOn(globalThis, 'fetch')
        .mockRejectedValue(new Error('Reference must not request data'));
      const { root } = await setup(`/design/${entry.id}`);
      const article = root.querySelector(`[data-component="${entry.id}"]`)!;
      expect(article.querySelector('h1')?.textContent).toBe(entry.name);
      expect(article.querySelectorAll('[data-variant]')).toHaveLength(entry.variants);
      expect(article.querySelector('#story-properties')).not.toBeNull();
      expect(article.querySelector('pre code')?.textContent?.trim()).not.toBe('');
      expect(
        root.querySelector(`[data-reference-link="${entry.id}"]`)?.getAttribute('aria-current'),
      ).toBe('page');
      TestBed.inject(HttpTestingController).expectNone(() => true);
      expect(fetch).not.toHaveBeenCalled();
    });
  }

  it('searches the inventory with Fuse and keeps singular and plural labels', async () => {
    const { harness, root } = await setup();
    const search = root.querySelector<HTMLInputElement>(
      '.reference-sidebar app-list-search input',
    )!;
    search.value = 'objctpicker';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(root.querySelectorAll('.reference-sidebar [data-reference-link]')).toHaveLength(1);
    expect(root.querySelector('.reference-sidebar [role="status"]')?.textContent).toBe(
      '1 composant',
    );
    TestBed.inject(I18nService).setLanguage('en');
    await harness.fixture.whenStable();
    expect(root.querySelector('.reference-sidebar [role="status"]')?.textContent).toBe(
      '1 component',
    );
    search.value = 'zzzzzzzzzz';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await harness.fixture.whenStable();
    expect(root.querySelector('.reference-sidebar nav')?.textContent).toContain(
      'No components match. Clear the search.',
    );
    root
      .querySelector<HTMLButtonElement>('.reference-sidebar .reference-navigation > button')!
      .click();
    await harness.fixture.whenStable();
    expect(root.querySelectorAll('.reference-sidebar [data-reference-link]')).toHaveLength(
      referenceCatalog.length,
    );
    expect(root.querySelector('.reference-sidebar [role="status"]')?.textContent).toBe(
      `${referenceCatalog.length} components`,
    );
  });

  it('connects native Signal Forms controls to the preview without executing the example text', async () => {
    const { harness, root } = await setup('/design/button');
    const label = root.querySelector<HTMLInputElement>('[storyControls] input')!;
    label.value = '<script>window.referenceExecuted = true</script>';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    const variant = root.querySelector<HTMLSelectElement>('[storyControls] select')!;
    variant.value = 'danger';
    variant.dispatchEvent(new Event('input', { bubbles: true }));
    variant.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
    const button = root.querySelector<HTMLButtonElement>('[storyPreview] button')!;
    expect(button.textContent).toContain(label.value);
    expect(button.dataset['buttonVariant']).toBe('danger');
    expect(root.querySelector('[storyPreview] script')).toBeNull();
    expect(root.querySelector('pre')?.textContent).toContain('variant="primary"');
    root.querySelector<HTMLInputElement>('[storyControls] input[type="checkbox"]')!.click();
    await harness.fixture.whenStable();
    expect(button.disabled).toBe(true);
  });

  it('uses the existing Drawer and restores focus on cancellation', async () => {
    const { harness, root, router } = await setup();
    const trigger = root.querySelector<HTMLButtonElement>('.reference-mobile-header button')!;
    trigger.focus();
    trigger.click();
    await harness.fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.activeElement).toBe(dialog.querySelector('[data-drawer-close]'));
    expect(dialog.querySelectorAll('[data-reference-link]')).toHaveLength(referenceCatalog.length);
    dialog.querySelector<HTMLButtonElement>('[data-drawer-close]')!.click();
    await harness.fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    trigger.click();
    await harness.fixture.whenStable();
    document
      .querySelector<HTMLAnchorElement>('[role="dialog"] [data-reference-link="badge"]')!
      .click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/design/badge');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(root.querySelector('h1')?.textContent).toBe('Badge');
  });

  it('opens categorized filters, commits a choice and restores category focus', async () => {
    const { harness, root } = await setup('/design/filter-menu');
    const trigger = root.querySelector<HTMLButtonElement>(
      '[storyPreview] app-filter-menu > button',
    )!;
    trigger.click();
    await harness.fixture.whenStable();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const category = dialog.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
    expect(document.activeElement).toBe(category);
    category.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(dialog.querySelector('app-filter-choice input'));
    dialog.querySelectorAll<HTMLElement>('[role="option"]')[1].click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
    expect(trigger.textContent).toContain('1');
    dialog.querySelector<HTMLButtonElement>('button.close')!.click();
    await harness.fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it('shows a failed lazy route and retries without losing the current page', async () => {
    const badgeRoute = designRoutes.find((route) => route.path === 'badge')!;
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('Simulated chunk failure'))
      .mockImplementation(() => badgeRoute.loadComponent!());
    TestBed.inject(Router).resetConfig([
      {
        path: 'design',
        component: DesignComponent,
        children: designRoutes.map((route) =>
          route.path === 'badge' ? { ...route, loadComponent: load } : route,
        ),
      },
    ]);
    const { harness, root, router } = await setup('/design/button');
    await expect(router.navigateByUrl('/design/badge')).rejects.toThrow('Simulated chunk failure');
    await harness.fixture.whenStable();
    expect(root.querySelector('[data-component="button"]')).not.toBeNull();
    expect(root.querySelector('.load-error')?.textContent).toContain(
      'Le composant n’a pas pu être chargé. Réessayez.',
    );
    expect(root.querySelector('.reference-content')?.getAttribute('aria-busy')).toBe('false');
    root.querySelector<HTMLButtonElement>('.load-error button')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/design/badge');
    expect(root.querySelector('.load-error')).toBeNull();
    expect(root.querySelector('[data-component="badge"]')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('marks the email invalid and focuses its native control after submission', async () => {
    const { harness, root } = await setup('/design/input');
    const input = root.querySelector<HTMLInputElement>('[storyPreview] input')!;
    root.querySelector<HTMLButtonElement>('[storyPreview] button[type="submit"]')!.click();
    await harness.fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
    expect(root.querySelector('#reference-email-error')?.textContent).toContain(
      'Saisissez une adresse courriel valide.',
    );
  });
});
