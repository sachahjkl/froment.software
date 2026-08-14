import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Blog, RenderedBlogPost } from '../../blog/blog';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-blog-post',
  imports: [RouterLink],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPost {
  private readonly blog = inject(Blog);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  protected readonly i18n = inject(I18nService);
  protected readonly post = computed<RenderedBlogPost | undefined>(() => {
    this.i18n.language();
    return this.blog.find(this.route.snapshot.paramMap.get('slug') ?? '');
  });

  constructor() {
    effect(() => {
      const post = this.post();
      if (post) {
        this.updateMetadata(post);
      }
    });
  }

  private updateMetadata(post: RenderedBlogPost): void {
    const pageTitle = `${post.title} | froment.software`;
    const url = `https://froment.software/blog/${post.slug}`;
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

    let structuredData =
      this.document.head.querySelector<HTMLScriptElement>('script[data-blog-post]');
    if (!structuredData) {
      structuredData = this.document.createElement('script');
      structuredData.type = 'application/ld+json';
      structuredData.setAttribute('data-blog-post', '');
      this.document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.description,
      datePublished: post.published,
      dateModified: post.updated,
      mainEntityOfPage: url,
      author: { '@type': 'Person', name: 'Sacha Froment', url: 'https://sacha.house' },
      publisher: {
        '@type': 'Organization',
        name: 'Froment Software',
        url: 'https://froment.software',
      },
      keywords: post.topics,
      inLanguage: this.i18n.language(),
    });
  }
}
