import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Blog as BlogService } from '../../blog/blog';
import { I18nService } from '../../i18n.service';

@Component({
  selector: 'app-blog',
  imports: [RouterLink],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blog {
  protected readonly blog = inject(BlogService);
  protected readonly i18n = inject(I18nService);
}
