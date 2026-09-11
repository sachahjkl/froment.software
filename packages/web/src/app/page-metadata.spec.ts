import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { PageMetadata, siteIdentityGraph } from './page-metadata';
import { blogPosts } from '@froment/l10n/blog-posts';
import { I18nService } from './i18n.service';

@Component({ template: '' })
class MetadataPage {}

describe('PageMetadata', () => {
  const post = blogPosts[0];
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'blog/:slug', component: MetadataPage },
          {
            path: 'about',
            component: MetadataPage,
            data: {
              titleKey: 'page.about',
              descriptionKey: 'page.description.about',
            },
          },
        ]),
      ],
    });
    TestBed.inject(I18nService).setLanguage('fr');
    TestBed.inject(PageMetadata);
  });

  it('replaces missing article metadata and restores valid article indexing', async () => {
    const i18n = TestBed.inject(I18nService);
    const harness = await RouterTestingHarness.create(`/blog/${post.slug}`);
    const content = (selector: string) =>
      document.head.querySelector(selector)?.getAttribute('content');
    expect(document.title).toBe(`${i18n.t(post.titleKey)} | froment.software`);

    await harness.navigateByUrl('/blog/missing');
    await harness.fixture.whenStable();
    expect(document.title).toBe(i18n.t('page.not_found'));
    expect(content('meta[name="description"]')).toBe(i18n.t('page.description.not_found'));
    expect(content('meta[property="og:title"]')).toBe(i18n.t('page.not_found'));
    expect(content('meta[name="twitter:description"]')).toBe(i18n.t('page.description.not_found'));
    expect(content('meta[name="robots"]')).toBe('noindex, nofollow');
    expect(document.head.querySelector('script[data-blog-post]')).toBeNull();

    i18n.setLanguage('en');
    await harness.fixture.whenStable();
    expect(document.title).toBe(i18n.t('page.not_found'));
    expect(content('meta[name="robots"]')).toBe('noindex, nofollow');

    await harness.navigateByUrl(`/blog/${post.slug}`);
    await harness.fixture.whenStable();
    expect(document.title).toBe(`${i18n.t(post.titleKey)} | froment.software`);
    expect(content('meta[name="robots"]')).toBe('index, follow');
  });

  it('sets article metadata and structured data without duplication', async () => {
    const harness = await RouterTestingHarness.create(`/blog/${post.slug}`);
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    await harness.fixture.whenStable();
    expect(document.title).toBe(`${i18n.t(post.titleKey)} | froment.software`);
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'article',
    );
    expect(document.head.querySelectorAll('script[data-blog-post]')).toHaveLength(1);
    expect(document.head.querySelector('script[data-blog-post]')?.textContent).toContain(
      '"sameAs":["https://sacha.house"]',
    );
  });

  it('describes the publisher and the founder in one identity graph', () => {
    const graph = JSON.stringify(
      siteIdentityGraph({
        publisher: 'Froment Software',
        author: 'Sacha Froment',
        description: 'Description',
        language: 'fr',
      }),
    );
    expect(graph).toContain('"@type":"Organization"');
    expect(graph).toContain('"@type":"WebSite"');
    expect(graph).toContain('"@type":"Person"');
    expect(graph).toContain('"sameAs":["https://sacha.house"]');
    expect(graph).toContain('"inLanguage":"fr"');
  });

  it('clears article metadata when leaving the blog', async () => {
    const harness = await RouterTestingHarness.create(`/blog/${post.slug}`);
    await harness.navigateByUrl('/about');
    await harness.fixture.whenStable();

    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'website',
    );
    expect(document.head.querySelector('meta[property="article:published_time"]')).toBeNull();
    expect(document.head.querySelector('script[data-blog-post]')).toBeNull();
  });

  it('does not index a missing article on initial navigation', async () => {
    const harness = await RouterTestingHarness.create('/blog/missing');
    await harness.fixture.whenStable();
    expect(document.title).toBe(TestBed.inject(I18nService).t('page.not_found'));
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
  });
});
