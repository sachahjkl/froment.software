import { ComponentFixture, TestBed } from '@angular/core/testing';
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
      providers: [provideRouter(routes)],
    }).compileComponents();
    router = TestBed.inject(Router);
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('fr');
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  it('exposes the skip target and current route without publishing the design route in navigation', async () => {
    const skipLink = element.querySelector<HTMLAnchorElement>('.skip-link')!;
    const main = element.querySelector<HTMLElement>('main#main-content')!;

    expect(skipLink.getAttribute('href')).toBe('#main-content');
    expect(main.tabIndex).toBe(-1);
    expect(router.config.some((route) => route.path === 'design')).toBe(true);
    expect(element.querySelector('a[href="/design"]')).toBeNull();

    await navigate(fixture, router, '/about');

    const current = element.querySelector<HTMLAnchorElement>('nav a[aria-current="page"]');
    expect(current?.getAttribute('href')).toBe('/about');
    expect(element.querySelector('app-about')).not.toBeNull();
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

    await navigate(fixture, router, '/design?preview=true#profile-sample');

    expect(meta('meta[name="robots"]').content).toBe('noindex, follow');
    expect(meta('meta[property="og:url"]').content).toBe('https://froment.software/design');
    expect(document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      'https://froment.software/design',
    );
    expect(element.querySelector('app-design')).not.toBeNull();
  });

  it('focuses main after post-initial navigation while preserving routed content', async () => {
    const main = element.querySelector<HTMLElement>('main#main-content')!;

    await navigate(fixture, router, '/about');
    expect(document.activeElement).not.toBe(main);

    await navigate(fixture, router, '/services');

    expect(document.activeElement).toBe(main);
    expect(element.querySelector('app-services')).not.toBeNull();
    expect(router.url).toBe('/services');
  });

  it('focuses a fragment heading without overriding anchor scroll on same-route navigation', async () => {
    await navigate(fixture, router, '/design');

    const main = element.querySelector<HTMLElement>('main#main-content')!;
    const target = element.querySelector<HTMLElement>('#profile-sample')!;
    const heading = target.querySelector<HTMLElement>('h2')!;

    await navigate(fixture, router, '/design#profile-sample');

    expect(document.activeElement).toBe(heading);
    expect(document.activeElement).not.toBe(main);
    expect(heading.getAttribute('tabindex')).toBe('-1');

    main.focus();
    expect(heading.hasAttribute('tabindex')).toBe(false);
  });

  it('focuses the fragment heading when navigating to a fragment on another path', async () => {
    await navigate(fixture, router, '/about');
    await navigate(fixture, router, '/design#profile-sample');

    const target = element.querySelector<HTMLElement>('#profile-sample')!;
    expect(document.activeElement).toBe(target.querySelector('h2'));
  });

  it('opens the mobile navigation and closes it after navigation', async () => {
    await navigate(fixture, router, '/about');

    const trigger = element.querySelector<HTMLButtonElement>('.menu-trigger')!;
    const navigation = element.querySelector<HTMLElement>('app-mobile-navigation')!;
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(navigation.classList.contains('open')).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    const servicesLink = navigation.querySelector<HTMLAnchorElement>('a[href="/services"]')!;
    servicesLink.click();
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(navigation.classList.contains('open')).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(router.url).toBe('/services');
  });

  it('switches theme and stores the user choice', async () => {
    const toggle = element.querySelector<HTMLButtonElement>('.theme-toggle')!;

    expect(document.documentElement.dataset['theme']).toBe('light');
    toggle.click();
    await fixture.whenStable();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('froment.software.theme')).toBe('dark');
    expect(toggle.getAttribute('aria-label')).toBe('Activer le mode clair');
  });

  it('closes the mobile navigation after an outside click', async () => {
    const trigger = element.querySelector<HTMLButtonElement>('.menu-trigger')!;
    trigger.click();
    await fixture.whenStable();

    element.querySelector<HTMLElement>('main')!.click();
    await fixture.whenStable();

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('copies a section URL and shows a status message', async () => {
    await navigate(fixture, router, '/services');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    element.querySelector<HTMLAnchorElement>('a[href="#prestations"]')!.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/#prestations$/));
    expect(element.querySelector('.copy-notice')?.textContent).toContain('Lien copié');
  });
});
