import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnchorCopy } from '../anchor-copy';

@Component({
  selector: 'app-copy-notice',
  imports: [],
  templateUrl: './copy-notice.html',
  styleUrl: './copy-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyNotice {
  protected readonly anchorCopy = inject(AnchorCopy);
}
