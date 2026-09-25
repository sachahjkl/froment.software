import { computed, inject, Injectable } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { I18nService, Language } from '@app/i18n.service';
import { localizedPath } from '@app/localized-route';
import { notes, type NoteMetadata } from '@froment/l10n/notes';
import { noteHeadingId } from '@shared/note-heading-id';
import deploymentEn from './posts/2026-09-du-commit-a-nomad.en.md';
import deploymentFr from './posts/2026-09-du-commit-a-nomad.fr.md';
import architectureEn from './posts/2026-08-architecture-effect.en.md';
import architectureFr from './posts/2026-08-architecture-effect.fr.md';
import launchEn from './posts/2026-08-froment-software-arrive.en.md';
import launchFr from './posts/2026-08-froment-software-arrive.fr.md';
import operationsEn from './posts/2026-08-production-observabilite.en.md';
import operationsFr from './posts/2026-08-production-observabilite.fr.md';
import securityEn from './posts/2026-08-securite-authentification.en.md';
import securityFr from './posts/2026-08-securite-authentification.fr.md';

const tocMarker = '<!-- notes-toc -->';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

type NoteHeading = {
  readonly depth: number;
  readonly id: string;
  readonly text: string;
};

export type Note = NoteMetadata & {
  body: Record<Language, string>;
};

export type RenderedNote = Omit<Note, 'titleKey' | 'descriptionKey' | 'topicKeys' | 'body'> & {
  title: string;
  description: string;
  topics: string[];
  html: string;
  safeHtml: SafeHtml;
};

const bodies = {
  '2026-09-du-commit-a-nomad': { fr: deploymentFr, en: deploymentEn },
  '2026-08-production-observabilite': { fr: operationsFr, en: operationsEn },
  '2026-08-securite-authentification': { fr: securityFr, en: securityEn },
  '2026-08-architecture-effect': { fr: architectureFr, en: architectureEn },
  '2026-08-froment-software-arrive': { fr: launchFr, en: launchEn },
} satisfies Record<(typeof notes)[number]['slug'], Record<Language, string>>;

const posts: Note[] = notes.map((post) => ({ ...post, body: bodies[post.slug] }));

export const noteSlugs = posts.map(({ slug }) => slug);

function collectHeadings(markdown: string): NoteHeading[] {
  const occurrences = new Map<string, number>();
  return marked.lexer(markdown).flatMap((token) => {
    if (token.type !== 'heading' || token.depth < 2) return [];
    return [
      {
        depth: token.depth,
        id: noteHeadingId(token.text, occurrences),
        text: token.text,
      },
    ];
  });
}

function renderTableOfContents(
  headings: readonly NoteHeading[],
  currentUrl: string,
  title: string,
): string {
  if (headings.length === 0) return '';
  const items = headings
    .map((heading) => {
      // oxlint-disable-next-line anti-slop/no-natural-language-literals -- TOC markup; heading text comes from Markdown.
      return `<li class="note-toc-depth-${heading.depth}"><a href="${escapeHtml(currentUrl)}#${heading.id}">${escapeHtml(heading.text)}</a></li>`;
    })
    .join('');
  // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Static TOC markup; labels come from translations.
  return `<nav class="note-toc" aria-labelledby="note-toc-title"><p class="note-toc-title" id="note-toc-title">${escapeHtml(title)}</p><ol>${items}</ol></nav>`;
}

@Injectable({
  providedIn: 'root',
})
export class Notes {
  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly posts = computed(() => posts.map((post) => this.localize(post)));
  readonly latest = computed(() => this.posts()[0]);

  find(slug: string, url?: string): RenderedNote | undefined {
    const post = posts.find((entry) => entry.slug === slug);
    return post ? this.localize(post, url) : undefined;
  }

  private localize(post: Note, url?: string): RenderedNote {
    const language = this.i18n.language();
    const currentUrl = (url ?? localizedPath(language, `/notes/${post.slug}`)).split('#')[0];
    const markdown = post.body[language];
    const headings = collectHeadings(markdown);
    const headingIds = new Map<string, string[]>();
    const headingIdByText = new Map<string, string>();
    for (const heading of headings) {
      const key = `${heading.depth}:${heading.text}`;
      const ids = headingIds.get(key) ?? [];
      ids.push(heading.id);
      headingIds.set(key, ids);
      if (!headingIdByText.has(heading.text)) headingIdByText.set(heading.text, heading.id);
    }
    const toc = renderTableOfContents(headings, currentUrl, this.i18n.t('notes.toc'));
    const renderer = new marked.Renderer();
    const renderLink = renderer.link.bind(renderer);
    renderer.html = ({ text }) => (text.trim() === tocMarker ? toc : escapeHtml(text));
    renderer.heading = ({ tokens, depth, text }) => {
      const ids = headingIds.get(`${depth}:${text}`);
      const id = ids?.shift() ?? noteHeadingId(text, new Map());
      // oxlint-disable-next-line anti-slop/no-natural-language-literals -- Heading markup; the text comes from Markdown.
      return `<h${depth} id="${id}">${renderer.parser.parseInline(tokens)}</h${depth}>`;
    };
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
      const id = headingIdByText.get(token.text) ?? noteHeadingId(token.text, new Map());
      return renderLink({ ...token, href: escapeHtml(`${currentUrl}#${id}`) });
    };
    const html = marked.parse(markdown, { async: false, gfm: true, renderer });
    // The Markdown files are compiled into the application; marked escapes raw HTML and cleans links.
    const safeHtml = this.sanitizer.bypassSecurityTrustHtml(html);

    return {
      slug: post.slug,
      published: post.published,
      updated: post.updated,
      title: this.i18n.t(post.titleKey),
      description: this.i18n.t(post.descriptionKey),
      topics: post.topicKeys.map((key) => this.i18n.t(key)),
      html,
      safeHtml,
    };
  }
}
