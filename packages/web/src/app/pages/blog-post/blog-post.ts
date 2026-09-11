import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Blog, RenderedBlogPost } from '../../blog/blog';
import { I18nService } from '@app/i18n.service';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';
import { MermaidDiagrams } from '@shared/mermaid-diagrams';

@Component({
  host: { class: 'page-container' },
  selector: 'app-blog-post',
  imports: [LocalizedDatePipe, MermaidDiagrams, RouterLink],
  templateUrl: './blog-post.html',
  styleUrl: './blog-post.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPost {
  private readonly blog = inject(Blog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParams = toSignal(this.route.queryParams, {
    initialValue: this.route.snapshot.queryParams,
  });
  protected readonly i18n = inject(I18nService);
  protected readonly post = computed<RenderedBlogPost | undefined>(() => {
    this.i18n.language();
    const url = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: this.queryParams(),
    });
    return this.blog.find(this.params().get('slug') ?? '', this.router.serializeUrl(url));
  });
}
