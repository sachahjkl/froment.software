import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, Component, effect, ElementRef, inject, Injector, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, NavigationSkipped, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { I18nService, TranslationKey } from './i18n.service';

const siteOrigin = 'https://froment.software';
const socialImageUrl = `${siteOrigin}/social-card.png`;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly brandName = 'froment.software';
  protected readonly currentYear = new Date().getFullYear();
  protected readonly navOpen = signal(false);
  private readonly navToggle = viewChild<ElementRef<HTMLButtonElement>>('navToggle');
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
  private readonly navigationSkipped = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationSkipped => event instanceof NavigationSkipped),
    ),
    { initialValue: null },
  );
  private initialNavigationComplete = this.router.navigated;
  private restoreFocusOnSkippedNavigation = false;

  constructor() {
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

      this.restoreFocusOnSkippedNavigation = false;
      this.navOpen.set(false);

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

    effect(() => {
      if (!this.navigationSkipped() || !this.restoreFocusOnSkippedNavigation) {
        return;
      }

      this.restoreFocusOnSkippedNavigation = false;
      this.focusNavToggleAfterRender();
    });
  }

  protected setLanguage(language: string): void {
    this.i18n.setLanguage(language);
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.restoreFocusOnSkippedNavigation = this.isBrowser
      && this.navOpen()
      && !!this.document.activeElement?.closest('#primary-navigation');
    this.navOpen.set(false);
  }

  private updateMetadata(): void {
    let route = this.activatedRoute.snapshot;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const titleKey = route.data['titleKey'] as TranslationKey | undefined;
    const descriptionKey = route.data['descriptionKey'] as TranslationKey | undefined;
    const robots = route.data['robots'] as string | undefined;
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

    const canonicalUrl = this.getCanonicalUrl();
    this.meta.updateTag({ property: 'og:locale', content: this.i18n.language() === 'fr' ? 'fr_FR' : 'en_US' });
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

    afterNextRender(() => {
      const target = this.document.getElementById(fragment);
      if (!target) {
        this.focusMain();
        return;
      }

      const focusTarget = target.matches('h1, h2, h3, h4, h5, h6, [role="heading"]')
        ? target
        : target.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6, [role="heading"]') ?? target;
      this.focusElement(focusTarget);
    }, { injector: this.injector });
  }

  private focusNavToggleAfterRender(): void {
    if (!this.isBrowser) {
      return;
    }

    afterNextRender(() => {
      const toggle = this.navToggle()?.nativeElement;
      if (toggle) {
        toggle.focus({ preventScroll: true });
        return;
      }

      this.focusMain();
    }, { injector: this.injector });
  }

  private focusElement(element: HTMLElement): void {
    const needsTemporaryTabIndex = !element.hasAttribute('tabindex')
      && !element.matches('a[href], area[href], button, input, select, textarea, iframe, [contenteditable="true"]');

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
