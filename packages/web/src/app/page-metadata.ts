import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { RenderedBlogPost } from './blog/blog';
import { I18nService, TranslationKey } from './i18n.service';

const origin = 'https://froment.software';
const socialImage = `${origin}/social-card-v4.png`;

@Injectable({ providedIn: 'root' })
export class PageMetadata {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );

  constructor() {
    effect(() => {
      this.i18n.language();
      this.navigationEnd();
      this.updateRoute();
    });
  }

  setBlogPost(post: RenderedBlogPost): void {
    const pageTitle = `${post.title} | froment.software`;
    const url = `${origin}/blog/${post.slug}`;
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: post.description });
    this.meta.updateTag({ name: 'keywords', content: post.topics.join(', ') });
    this.meta.updateTag({ property: 'og:type', content: 'article' });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: post.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'article:published_time', content: post.published });
    this.meta.updateTag({ property: 'article:modified_time', content: post.updated });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: post.description });
    let script = this.document.head.querySelector<HTMLScriptElement>('script[data-blog-post]');
    if (!script) {
      script = this.document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-blog-post', '');
      this.document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.published,
      dateModified: post.updated,
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: 'Sacha Froment', url: 'https://sacha.house' },
      publisher: { '@type': 'Organization', name: 'Froment Software', url: origin },
      keywords: post.topics,
      inLanguage: this.i18n.language(),
    });
  }

  private updateRoute(): void {
    let route = this.route.snapshot;
    while (route.firstChild) route = route.firstChild;
    const titleKey: TranslationKey | undefined = route.data['titleKey'];
    const descriptionKey: TranslationKey | undefined = route.data['descriptionKey'];
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
    this.meta.updateTag({ name: 'robots', content: route.data['robots'] ?? 'index, follow' });
    if (route.routeConfig?.path !== 'blog/:slug') this.clearBlogPost();
    const url = this.canonicalUrl();
    this.meta.updateTag({
      property: 'og:locale',
      content: this.i18n.language() === 'fr' ? 'fr_FR' : 'en_US',
    });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:image', content: socialImage });
    this.meta.updateTag({ name: 'twitter:image', content: socialImage });
    const alt = this.i18n.t('meta.socialImageAlt');
    this.meta.updateTag({ property: 'og:image:alt', content: alt });
    this.meta.updateTag({ name: 'twitter:image:alt', content: alt });
    this.updateCanonicalLink(url);
  }

  private clearBlogPost(): void {
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.removeTag('property="article:published_time"');
    this.meta.removeTag('property="article:modified_time"');
    this.meta.removeTag('name="keywords"');
    this.document.head.querySelector('script[data-blog-post]')?.remove();
  }

  private canonicalUrl(): string {
    const suffix = this.router.url.search(/[?#]/);
    const path = suffix === -1 ? this.router.url : this.router.url.slice(0, suffix);
    return `${origin}${path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path || '/'}`;
  }

  private updateCanonicalLink(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}
