import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageMetadata } from './page-metadata';

describe('PageMetadata', () => {
  it('sets article metadata and structured data without duplication', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const metadata = TestBed.inject(PageMetadata);
    const post = {
      slug: 'post',
      published: '2026-08-01',
      updated: '2026-08-02',
      title: 'Post',
      description: 'Description',
      topics: ['Angular'],
      html: '<p>Post</p>',
    };
    metadata.setBlogPost(post);
    metadata.setBlogPost(post);
    expect(document.title).toBe('Post | froment.software');
    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'article',
    );
    expect(document.head.querySelectorAll('script[data-blog-post]')).toHaveLength(1);
  });

  it('clears article metadata when a blog post is absent', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const metadata = TestBed.inject(PageMetadata);
    metadata.setBlogPost({
      slug: 'post',
      published: '2026-08-01',
      updated: '2026-08-02',
      title: 'Post',
      description: 'Description',
      topics: ['Angular'],
      html: '<p>Post</p>',
    });

    metadata.clearBlogPost();

    expect(document.head.querySelector('meta[property="og:type"]')?.getAttribute('content')).toBe(
      'website',
    );
    expect(document.head.querySelector('meta[property="article:published_time"]')).toBeNull();
    expect(document.head.querySelector('script[data-blog-post]')).toBeNull();
  });
});
