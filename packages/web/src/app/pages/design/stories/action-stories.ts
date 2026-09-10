import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Button, type ButtonVariant } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';
import { ActionMenu, type MenuAction } from '@shared/action-menu/action-menu';
import { SplitAction } from '@shared/split-action/split-action';
import { CopyField } from '@shared/copy-field/copy-field';
import { AnchorLink } from '@shared/anchor-link/anchor-link';
import { AnchorCopy } from '@shared/anchor-copy';
import { currentReference, StoryPage, type StoryDefinition } from '../story-page';
import { referenceText } from '../reference-text';

interface ActionPreview {
  label: string;
  value: string;
  description: string;
  actionLabel: string;
  menuLabel: string;
  commandLabel: string;
  commandDisabled: boolean;
  commandDanger: boolean;
  fragment: string;
  noticeMessage: string;
  variant: ButtonVariant;
  disabled: boolean;
  iconOnly: boolean;
  menuDisabled: boolean;
}

export const buttonVariants: readonly ButtonVariant[] = [
  'default',
  'primary',
  'info',
  'success',
  'warning',
  'danger',
  'dark',
  'link',
];

@Component({
  selector: 'app-action-stories',
  imports: [
    FormField,
    RouterLink,
    StoryPage,
    Button,
    Icon,
    ActionMenu,
    SplitAction,
    CopyField,
    AnchorLink,
  ],
  templateUrl: './action-stories.html',
  styleUrl: './story.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionStories {
  protected readonly entry = currentReference();
  protected readonly text = referenceText();
  protected get definition(): StoryDefinition {
    return this.text().stories[this.entry.id];
  }
  protected readonly variants = buttonVariants;
  protected readonly anchorCopy = inject(AnchorCopy);
  protected readonly model = signal<ActionPreview>({
    label: this.entry.id === 'copy-notice' ? this.text().copy : this.text().content,
    value: this.text().examples.firstValue,
    description: '',
    actionLabel: this.text().copy,
    menuLabel: this.text().details,
    commandLabel: this.text().edit,
    commandDisabled: false,
    commandDanger: false,
    fragment: 'reference-anchor',
    noticeMessage: this.text().copyNoticeMessage,
    variant: 'primary',
    disabled: false,
    iconOnly: false,
    menuDisabled: false,
  });
  protected readonly controls = form(this.model);
  protected readonly event = signal('');
  protected readonly actions = computed<readonly MenuAction[]>(() => [
    {
      id: 'edit',
      label: this.model().commandLabel,
      disabled: this.model().commandDisabled,
      danger: this.model().commandDanger,
    },
    { id: 'unavailable', label: this.text().unavailable, disabled: true },
    { id: 'remove', label: this.text().remove, danger: true },
  ]);
}
