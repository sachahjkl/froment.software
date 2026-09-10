import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { QuoteConditionPresets } from './quote-condition-presets';

@Component({
  imports: [Button, Notice, FormField, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-condition-editor',
  styleUrl: './condition-editor.scss',
  templateUrl: './condition-editor.html',
})
export class ConditionEditor extends QuoteConditionPresets {
  protected override readonly editor = true;
}
