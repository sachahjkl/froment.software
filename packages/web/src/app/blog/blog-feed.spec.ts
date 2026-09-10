import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import xml from '../../../public/blog/feed.atom' with { loader: 'text' };
import { Blog } from './blog';

describe('Blog Atom feed', () => {
  let document: Document;

  beforeEach(() => {
    document = new DOMParser().parseFromString(xml, 'application/xml');
    expect(document.querySelector('parsererror')).toBeNull();
    TestBed.inject(I18nService).setLanguage('fr');
  });

  it('declares Atom metadata and public URLs', () => {
    const i18n = TestBed.inject(I18nService);
    const feedUrl = 'https://froment.software/blog/feed.atom';
    const feed = document.documentElement;

    expect(feed.localName).toBe('feed');
    expect(feed.namespaceURI).toBe('http://www.w3.org/2005/Atom');
    expect(feed.getAttribute('xml:lang')).toBe('fr');
    expect(document.querySelector('feed > id')?.textContent).toBe(feedUrl);
    expect(document.querySelector('feed > title')?.textContent).toBeTruthy();
    expect(document.querySelector('feed > subtitle')?.textContent).toBe(i18n.t('blog.lead'));
    expect(document.querySelector('feed > author > name')?.textContent).toBe(
      i18n.t('metadata.author'),
    );
    expect(document.querySelector('feed > link[rel="self"]')?.getAttribute('href')).toBe(feedUrl);
    expect(document.querySelector('feed > link[rel="self"]')?.getAttribute('type')).toBe(
      'application/atom+xml',
    );
    expect(document.querySelector('feed > link[rel="alternate"]')?.getAttribute('href')).toBe(
      'https://froment.software/blog',
    );
  });

  it('keeps all entries aligned with the published French blog data', () => {
    const posts = TestBed.inject(Blog).posts();
    const entries = Array.from(document.querySelectorAll('feed > entry'));
    const ids = entries.map((entry) => entry.querySelector('id')?.textContent);
    const latestUpdated = posts
      .map((post) => post.updated)
      .sort()
      .at(-1);

    expect(entries).toHaveLength(posts.length);
    expect(new Set(ids).size).toBe(posts.length);
    expect(document.querySelector('feed > updated')?.textContent).toBe(
      `${latestUpdated}T00:00:00Z`,
    );

    for (const post of posts) {
      const url = `https://froment.software/blog/${post.slug}`;
      const entry = entries.find((candidate) => candidate.querySelector('id')?.textContent === url);

      expect(entry?.querySelector('title')?.textContent).toBe(post.title);
      expect(entry?.querySelector('summary')?.textContent).toBe(post.description);
      expect(entry?.querySelector('published')?.textContent).toBe(`${post.published}T00:00:00Z`);
      expect(entry?.querySelector('updated')?.textContent).toBe(`${post.updated}T00:00:00Z`);
      expect(entry?.querySelector('link[rel="alternate"]')?.getAttribute('href')).toBe(url);
      expect(entry?.querySelector('link[rel="alternate"]')?.getAttribute('type')).toBe('text/html');
      expect(entry?.querySelector('link[rel="alternate"]')?.getAttribute('hreflang')).toBe('fr');
      expect(
        Array.from(entry?.querySelectorAll('category') ?? [], (category) =>
          category.getAttribute('term'),
        ),
      ).toEqual(post.topics);
    }
  });
});
