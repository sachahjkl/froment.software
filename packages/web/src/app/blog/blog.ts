import { computed, inject, Injectable } from '@angular/core';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { I18nService, Language, TranslationKey } from '@app/i18n.service';
import launchEn from './posts/2026-08-froment-software-arrive.en.md';
import launchFr from './posts/2026-08-froment-software-arrive.fr.md';

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
    renderer.html = ({ text }) => text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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
