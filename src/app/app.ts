import { Title } from '@angular/platform-browser';
import { Component, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Meta } from '@angular/platform-browser';
import { I18nService, TranslationKey } from './i18n.service';

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
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.navOpen.set(false);
        this.updateTitle();
      }
    });

    effect(() => {
      this.i18n.language();
      this.updateTitle();
    });
  }

  protected setLanguage(language: string): void {
    this.i18n.setLanguage(language);
  }

  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  private updateTitle(): void {
    let route = this.activatedRoute.snapshot;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const titleKey = route.data['titleKey'] as TranslationKey | undefined;
    const descriptionKey = route.data['descriptionKey'] as TranslationKey | undefined;
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

    this.meta.updateTag({ property: 'og:locale', content: this.i18n.language() === 'fr' ? 'fr_FR' : 'en_US' });
    this.meta.updateTag({ property: 'og:url', content: `https://froment.software${this.router.url}` });
  }
}
