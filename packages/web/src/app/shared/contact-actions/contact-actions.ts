import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Button } from '../button/button';
import { Icon } from '../icon/icon';
import { contactMailto } from './contact-mailto';

@Component({
  selector: 'app-contact-actions',
  imports: [Button, Icon],
  templateUrl: './contact-actions.html',
  styleUrl: './contact-actions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactActions {
  readonly mailLabel = input.required<string>();
  readonly bookLabel = input.required<string>();
  readonly subject = input('');
  readonly body = input('');

  protected readonly mailto = computed(() => contactMailto(this.subject(), this.body()));
}
