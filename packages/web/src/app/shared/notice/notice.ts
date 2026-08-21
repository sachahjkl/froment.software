import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NoticeVariant = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'p[appNotice]',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'notice',
    '[class.success]': "variant() === 'success'",
    '[class.warning]': "variant() === 'warning'",
    '[class.danger]': "variant() === 'danger'",
  },
})
export class Notice {
  readonly variant = input<NoticeVariant>('info');
}
