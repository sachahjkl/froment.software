import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Icon } from '../icon/icon';
import { LinkButton } from '../link-button/link-button';

@Component({
  selector: 'app-contact-actions',
  imports: [Icon, LinkButton],
  templateUrl: './contact-actions.html',
  styleUrl: './contact-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactActions {
  readonly mailLabel = input.required<string>();
  readonly bookLabel = input.required<string>();
  readonly subject = input('');
  readonly body = input('');

  protected readonly mailto = computed(() => {
    const query = new URLSearchParams();
    if (this.subject()) {
      query.set('subject', this.subject());
    }
    if (this.body()) {
      query.set('body', this.body());
    }

    const parameters = query.toString();
    return `mailto:contact@froment.software${parameters ? `?${parameters}` : ''}`;
  });
}
