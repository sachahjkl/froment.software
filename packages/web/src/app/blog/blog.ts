import { computed, inject, Injectable } from '@angular/core';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { I18nService, Language } from '@app/i18n.service';
import { blogPosts, type BlogPostMetadata } from '@froment/l10n/blog-posts';
import { blogHeadingId } from '@shared/blog-heading-id';
import architectureEn from './posts/2026-08-architecture-effect.en.md';
import architectureFr from './posts/2026-08-architecture-effect.fr.md';
import launchEn from './posts/2026-08-froment-software-arrive.en.md';
import launchFr from './posts/2026-08-froment-software-arrive.fr.md';
import operationsEn from './posts/2026-08-production-observabilite.en.md';
import operationsFr from './posts/2026-08-production-observabilite.fr.md';
import securityEn from './posts/2026-08-securite-authentification.en.md';
import securityFr from './posts/2026-08-securite-authentification.fr.md';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

export type BlogPost = BlogPostMetadata & {
  body: Record<Language, string>;
};

export type RenderedBlogPost = Omit<
  BlogPost,
  'titleKey' | 'descriptionKey' | 'topicKeys' | 'body'
> & {
  title: string;
  description: string;
  topics: string[];
  html: string;
};

const bodies = {
  '2026-08-production-observabilite': { fr: operationsFr, en: operationsEn },
  '2026-08-securite-authentification': { fr: securityFr, en: securityEn },
  '2026-08-architecture-effect': { fr: architectureFr, en: architectureEn },
  '2026-08-froment-software-arrive': { fr: launchFr, en: launchEn },
} satisfies Record<(typeof blogPosts)[number]['slug'], Record<Language, string>>;

const posts: BlogPost[] = blogPosts.map((post) => ({ ...post, body: bodies[post.slug] }));

export const blogPostSlugs = posts.map(({ slug }) => slug);

@Injectable({
  providedIn: 'root',
})
export class Blog {
  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly posts = computed(() => posts.map((post) => this.localize(post)));
  readonly latest = computed(() => this.posts()[0]);

  find(slug: string): RenderedBlogPost | undefined {
    const post = posts.find((entry) => entry.slug === slug);
    return post ? this.localize(post) : undefined;
  }

  private localize(post: BlogPost): RenderedBlogPost {
    const language = this.i18n.language();
    const renderer = new marked.Renderer();
    const renderLink = renderer.link.bind(renderer);
    renderer.html = ({ text }) => escapeHtml(text);
    renderer.code = ({ text, lang }) => {
      const languageName = lang?.trim().split(/\s+/, 1)[0];
      if (languageName === 'mermaid') {
        return '<pre' + ' class=' + '"mermaid"' + '>' + escapeHtml(text) + '</pre>';
      }
      const languageClass = languageName ? ` class="language-${escapeHtml(languageName)}"` : '';
      return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>`;
    };
    renderer.link = (token) => {
      if (!token.href.startsWith('#')) return renderLink(token);
      const id = blogHeadingId(token.text, new Map());
      return (
        '<a' + ' href=' + '"#' + id + '">' + renderer.parser.parseInline(token.tokens) + '</a>'
      );
    };
    const html = marked.parse(post.body[language], { async: false, gfm: true, renderer });

    return {
      slug: post.slug,
      published: post.published,
      updated: post.updated,
      title: this.i18n.t(post.titleKey),
      description: this.i18n.t(post.descriptionKey),
      topics: post.topicKeys.map((key) => this.i18n.t(key)),
      html: this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '',
    };
  }
}
