import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  inject,
  Injector,
  PLATFORM_ID,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { I18nService, TranslationKey } from './i18n.service';
import { AnchorCopy } from './shared/anchor-copy';
import { NewLabel } from './shared/new-label/new-label';

const siteOrigin = 'https://froment.software';
const socialImageUrl = `${siteOrigin}/social-card-v4.png`;
const themeStorageKey = 'froment.software.theme';
type Theme = 'light' | 'dark';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NewLabel, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly brandName = 'froment.software';
  protected readonly currentYear = new Date().getFullYear();
  protected readonly anchorCopy = inject(AnchorCopy);
  protected readonly theme = signal<Theme>('light');
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );
  private initialNavigationComplete = this.router.navigated;

  constructor() {
    afterNextRender(() => this.applyTheme(this.detectTheme(), false), { injector: this.injector });

    effect(() => {
      this.i18n.language();
      this.navigationEnd();
      this.updateMetadata();
    });

    effect(() => {
      const navigation = this.navigationEnd();
      if (!navigation) {
        return;
      }

      if (!this.initialNavigationComplete) {
        this.initialNavigationComplete = true;
        return;
      }

      const fragment = this.router.parseUrl(navigation.urlAfterRedirects).fragment;
      if (fragment) {
        this.focusFragmentAfterRender(fragment);
        return;
      }

      this.focusMainAfterRender();
    });
  }

  protected setLanguage(language: string): void {
    this.i18n.setLanguage(language);
  }

  protected toggleTheme(): void {
    this.applyTheme(this.theme() === 'dark' ? 'light' : 'dark');
  }

  protected closeNavOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.nav-details')) {
      return;
    }

    this.document.querySelector<HTMLDetailsElement>('.nav-details[open]')?.removeAttribute('open');
  }

  private detectTheme(): Theme {
    const window = this.document.defaultView;
    const storedTheme = window?.localStorage.getItem(themeStorageKey);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return window?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  private applyTheme(theme: Theme, store = true): void {
    this.theme.set(theme);
    this.document.documentElement.dataset['theme'] = theme;
    this.meta.updateTag({ name: 'theme-color', content: theme === 'dark' ? '#17171f' : '#f3f2f6' });
    if (store) {
      this.document.defaultView?.localStorage.setItem(themeStorageKey, theme);
    }
  }

  private updateMetadata(): void {
    let route = this.activatedRoute.snapshot;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const titleKey = route.data['titleKey'] as TranslationKey | undefined;
    const descriptionKey = route.data['descriptionKey'] as TranslationKey | undefined;
    const robots = route.data['robots'] as string | undefined;
    const isBlogPost = route.routeConfig?.path === 'blog/:slug';
    if (titleKey) {
      const title = this.i18n.t(titleKey);
      this.title.setTitle(title);
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ name: 'twitter:title', content: title });
    }

    if (descriptionKey) {
      const description = this.i18n.t(descriptionKey);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
      this.meta.updateTag({ name: 'twitter:description', content: description });
    }
    this.meta.updateTag({ name: 'robots', content: robots ?? 'index, follow' });
    if (!isBlogPost) {
      this.meta.updateTag({ property: 'og:type', content: 'website' });
      this.meta.removeTag('property="article:published_time"');
      this.meta.removeTag('property="article:modified_time"');
      this.document.head.querySelector('script[data-blog-post]')?.remove();
    }

    const canonicalUrl = this.getCanonicalUrl();
    this.meta.updateTag({
      property: 'og:locale',
      content: this.i18n.language() === 'fr' ? 'fr_FR' : 'en_US',
    });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.meta.updateTag({ property: 'og:image', content: socialImageUrl });
    this.meta.updateTag({ name: 'twitter:image', content: socialImageUrl });
    const socialImageAlt = this.i18n.t('meta.socialImageAlt');
    this.meta.updateTag({ property: 'og:image:alt', content: socialImageAlt });
    this.meta.updateTag({ name: 'twitter:image:alt', content: socialImageAlt });
    this.updateCanonicalLink(canonicalUrl);
  }

  private getCanonicalUrl(): string {
    const routeUrl = this.router.url;
    const suffixStart = routeUrl.search(/[?#]/);
    const path = suffixStart === -1 ? routeUrl : routeUrl.slice(0, suffixStart);
    const canonicalPath = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

    return `${siteOrigin}${canonicalPath || '/'}`;
  }

  private updateCanonicalLink(url: string): void {
    let canonical = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }

    canonical.href = url;
  }

  private focusFragmentAfterRender(fragment: string): void {
    if (!this.isBrowser) {
      return;
    }

    afterNextRender(
      () => {
        const target = this.document.getElementById(fragment);
        if (!target) {
          this.focusMain();
          return;
        }

        const focusTarget = target.matches('h1, h2, h3, h4, h5, h6, [role="heading"]')
          ? target
          : (target.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]') ??
            target);
        this.focusElement(focusTarget);
      },
      { injector: this.injector },
    );
  }

  private focusElement(element: HTMLElement): void {
    const needsTemporaryTabIndex =
      !element.hasAttribute('tabindex') &&
      !element.matches(
        'a[href], area[href], button, input, select, textarea, iframe, [contenteditable="true"]',
      );

    if (needsTemporaryTabIndex) {
      element.tabIndex = -1;
    }

    element.focus({ preventScroll: true });

    if (needsTemporaryTabIndex) {
      if (this.document.activeElement !== element) {
        element.removeAttribute('tabindex');
        return;
      }

      element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
    }
  }

  private focusMain(): void {
    this.document.getElementById('main-content')?.focus({ preventScroll: true });
  }

  private focusMainAfterRender(): void {
    if (!this.isBrowser) {
      return;
    }

    afterNextRender(() => this.focusMain(), { injector: this.injector });
  }
}
