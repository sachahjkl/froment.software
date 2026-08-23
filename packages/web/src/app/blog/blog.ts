import { computed, inject, Injectable } from '@angular/core';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { I18nService, Language, TranslationKey } from '@app/i18n.service';
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

export type BlogPost = {
  slug: string;
  published: string;
  updated: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  topicKeys: readonly TranslationKey[];
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

const posts: BlogPost[] = [
  {
    slug: '2026-08-production-observabilite',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'blog.operations.title',
    descriptionKey: 'blog.operations.description',
    topicKeys: ['blog.topic.nix', 'blog.topic.secrets', 'blog.topic.observability'],
    body: { fr: operationsFr, en: operationsEn },
  },
  {
    slug: '2026-08-securite-authentification',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'blog.security.title',
    descriptionKey: 'blog.security.description',
    topicKeys: ['blog.topic.security', 'blog.topic.authentication', 'blog.topic.audit'],
    body: { fr: securityFr, en: securityEn },
  },
  {
    slug: '2026-08-architecture-effect',
    published: '2026-08-23',
    updated: '2026-08-23',
    titleKey: 'blog.architecture.title',
    descriptionKey: 'blog.architecture.description',
    topicKeys: ['blog.topic.effect', 'blog.topic.sqlite', 'blog.topic.documents'],
    body: { fr: architectureFr, en: architectureEn },
  },
  {
    slug: '2026-08-froment-software-arrive',
    published: '2026-08-12',
    updated: '2026-08-12',
    titleKey: 'blog.launch.title',
    descriptionKey: 'blog.launch.description',
    topicKeys: [
      'blog.launch.topic.development',
      'blog.launch.topic.takeover',
      'blog.launch.topic.ci',
      'blog.launch.topic.nixos',
      'blog.launch.topic.infrastructure',
    ],
    body: { fr: launchFr, en: launchEn },
  },
];

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
