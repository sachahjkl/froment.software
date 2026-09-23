import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { I18nService } from './i18n.service';

async function navigate(
  fixture: ComponentFixture<App>,
  router: Router,
  url: string,
): Promise<void> {
  expect(await router.navigateByUrl(url)).toBe(true);
  await fixture.whenStable();
}

function meta(selector: string): HTMLMetaElement {
  const element = document.head.querySelector<HTMLMetaElement>(selector);
  expect(element).not.toBeNull();
  return element!;
}

describe('App shell', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let i18n: I18nService;
  let element: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter(routes)],
    }).compileComponents();
    router = TestBed.inject(Router);
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('fr');
    fixture = TestBed.createComponent(App);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    element = fixture.nativeElement;
  });

  it('exposes the skip target', async () => {
    const skipLink = element.querySelector<HTMLAnchorElement>('.skip-link')!;
    const main = element.querySelector<HTMLElement>('main#main-content')!;

    expect(skipLink.getAttribute('href')).toBe('#main-content');
    expect(main.tabIndex).toBe(-1);
    expect(element.querySelector('app-site-header')).toBeNull();
    expect(element.querySelector('app-site-footer')).not.toBeNull();

    await navigate(fixture, router, '/about');

    expect(element.querySelector('app-about')).not.toBeNull();
  });

  it('uses the URL to select the landing page language', async () => {
    expect(router.url).toBe('/fr');
    expect(i18n.language()).toBe('fr');

    await navigate(fixture, router, '/en');

    expect(i18n.language()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(element.querySelector('app-site-header')).toBeNull();
    expect(element.querySelector('app-site-footer')).not.toBeNull();
  });

  it('uses the standalone shell for the version page', async () => {
    await navigate(fixture, router, '/version');

    expect(element.querySelector('.app-shell')?.classList).toContain('standalone-shell');
    expect(element.querySelector('app-site-header')).toBeNull();
    expect(element.querySelector('app-site-footer')).toBeNull();
    expect(element.querySelector('main#main-content app-version')).not.toBeNull();
  });

  it('updates canonical, robots, and social metadata for route and language changes', async () => {
    await navigate(fixture, router, '/about');

    const frenchTitle = meta('meta[property="og:title"]').content;
    const frenchDescription = meta('meta[property="og:description"]').content;
    const frenchImageAlt = meta('meta[property="og:image:alt"]').content;

    i18n.setLanguage('en');
    await fixture.whenStable();

    expect(meta('meta[property="og:title"]').content).not.toBe(frenchTitle);
    expect(meta('meta[property="og:description"]').content).not.toBe(frenchDescription);
    expect(meta('meta[property="og:image:alt"]').content).not.toBe(frenchImageAlt);
    expect(meta('meta[property="og:locale"]').content).toBe('en_US');
    expect(meta('meta[name="twitter:title"]').content).toBe(
      meta('meta[property="og:title"]').content,
    );
    expect(meta('meta[name="twitter:description"]').content).toBe(
      meta('meta[property="og:description"]').content,
    );
    expect(meta('meta[name="twitter:image:alt"]').content).toBe(
      meta('meta[property="og:image:alt"]').content,
    );

    await navigate(fixture, router, '/404');

    expect(meta('meta[name="robots"]').content).toBe('noindex, nofollow');
    expect(meta('meta[property="og:url"]').content).toBe('https://froment.software/404');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://froment.software/404',
    );
    expect(element.querySelector('app-not-found')).not.toBeNull();
  });

  it('focuses main after post-initial navigation while preserving routed content', async () => {
    const main = element.querySelector<HTMLElement>('main#main-content')!;

    expect(document.activeElement).not.toBe(main);
    await navigate(fixture, router, '/about');
    expect(document.activeElement).toBe(main);
    await navigate(fixture, router, '/services');

    expect(document.activeElement).toBe(main);
    expect(element.querySelector('app-services')).not.toBeNull();
    expect(router.url).toBe('/services');
  });

  it('focuses a fragment heading without overriding anchor scroll on same-route navigation', async () => {
    await navigate(fixture, router, '/about');

    const main = element.querySelector<HTMLElement>('main#main-content')!;
    const heading = element.querySelector<HTMLElement>('h2#contact')!;

    await navigate(fixture, router, '/about#contact');

    expect(document.activeElement).toBe(heading);
    expect(document.activeElement).not.toBe(main);
    expect(heading.getAttribute('tabindex')).toBe('-1');

    main.focus();
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('focuses the fragment heading when navigating to a fragment on another path', async () => {
    await navigate(fixture, router, '/services');
    await navigate(fixture, router, '/about#contact');

    expect(document.activeElement).toBe(element.querySelector('h2#contact'));
  });

  it('copies a section URL and shows a status message', async () => {
    await navigate(fixture, router, '/services');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    const url = router.url;
    element.querySelector<HTMLButtonElement>('app-anchor-link button')!.click();
    await fixture.whenStable();

    expect(router.url).toBe(url);
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#prestations$/));
    expect(element.querySelector('.copy-notice')?.textContent).toContain('Lien copié');
  });
});
