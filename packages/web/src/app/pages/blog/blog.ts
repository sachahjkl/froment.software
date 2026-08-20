import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Blog as BlogService } from '../../blog/blog';
import { I18nService } from '@app/i18n.service';
import { LocalizedDatePipe } from '@shared/localized-date/localized-date-pipe';

@Component({
  selector: 'app-blog',
  imports: [LocalizedDatePipe, RouterLink],
  templateUrl: './blog.html',
  styleUrl: './blog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Blog {
  protected readonly blog = inject(BlogService);
  protected readonly i18n = inject(I18nService);
}
