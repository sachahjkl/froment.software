import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Button } from '@shared/button/button';
import { Notice } from '@shared/notice/notice';
import { CopyField } from '@shared/copy-field/copy-field';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';
import { ApiTokens } from './api-tokens';

@Component({
  host: { class: 'page-container' },
  imports: [FormField, RouterLink, Button, Notice, CopyField, SearchHighlight],
  providers: [SearchHighlightRegistry],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-api-token-editor',
  styleUrl: './api-token-editor.scss',
  templateUrl: './api-token-editor.html',
})
export class ApiTokenEditor extends ApiTokens {
  protected override readonly editor = true;
  private readonly secretHeading = viewChild('secretHeading', { read: ElementRef<HTMLElement> });
  constructor() {
    super();
    afterRenderEffect(() => {
      if (this.secret()) this.secretHeading()?.nativeElement.focus();
    });
  }
}
