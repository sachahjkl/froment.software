import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  selector: 'app-page-header',
  styleUrl: './page-header.scss',
  templateUrl: './page-header.html',
  host: { '[attr.data-header-layout]': 'layout()' },
})
export class PageHeader {
  readonly layout = input<'inline' | 'stacked'>('inline');
}
