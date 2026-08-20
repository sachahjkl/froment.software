import { computed, inject, Injectable } from '@angular/core';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { marked } from 'marked';
import { I18nService, Language } from '@app/i18n.service';
import launchEn from './posts/2026-08-froment-software-arrive.en.md';
import launchFr from './posts/2026-08-froment-software-arrive.fr.md';

export type BlogPost = {
  slug: string;
  published: string;
  updated: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  topics: Record<Language, string[]>;
  body: Record<Language, string>;
};

export type RenderedBlogPost = Omit<BlogPost, 'title' | 'description' | 'topics' | 'body'> & {
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
    title: {
      fr: 'Froment Software arrive sur le marché',
      en: 'Froment Software enters the market',
    },
    description: {
      fr: 'Présentation de Froment Software, de ses missions et de sa méthode fondée sur des changements mesurables.',
      en: 'Introducing Froment Software, its services and its method based on measurable changes.',
    },
    topics: {
      fr: [
        'développement logiciel',
        'reprise d’applications',
        'CI/CD',
        'NixOS',
        'infrastructure as code',
      ],
      en: [
        'software development',
        'application takeover',
        'CI/CD',
        'NixOS',
        'infrastructure as code',
      ],
    },
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
      title: post.title[language],
      description: post.description[language],
      topics: post.topics[language],
      html: this.sanitizer.sanitize(SecurityContext.HTML, html) ?? '',
    };
  }
}
