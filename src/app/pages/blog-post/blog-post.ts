import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Blog, RenderedBlogPost } from '../../blog/blog';
import { I18nService } from '../../i18n.service';
import { PageMetadata } from '../../page-metadata';
import { LocalizedDatePipe } from '../../shared/localized-date/localized-date-pipe';

@Component({
  selector: 'app-blog-post',
  imports: [LocalizedDatePipe, RouterLink],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPost {
  private readonly blog = inject(Blog);
  private readonly route = inject(ActivatedRoute);
  private readonly metadata = inject(PageMetadata);
  protected readonly i18n = inject(I18nService);
  protected readonly post = computed<RenderedBlogPost | undefined>(() => {
    this.i18n.language();
    return this.blog.find(this.route.snapshot.paramMap.get('slug') ?? '');
  });

  constructor() {
    effect(() => {
      const post = this.post();
      if (post) {
        this.metadata.setBlogPost(post);
      }
    });
  }
}
