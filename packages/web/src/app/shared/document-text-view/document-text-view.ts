import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import {
  parseDocumentText,
  type DocumentTextBlock,
  type DocumentTextPresentationValue,
} from '@froment/contracts';

@Component({
  imports: [forwardRef(() => DocumentTextView)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-document-text-view',
  styleUrl: './document-text-view.scss',
  templateUrl: './document-text-view.html',
})
export class DocumentTextView {
  readonly source = input('');
  readonly presentation = input<DocumentTextPresentationValue>();
  readonly blocks = input<ReadonlyArray<DocumentTextBlock>>();
  protected readonly content = computed(() => {
    const blocks = this.blocks();
    if (blocks !== undefined) return blocks;
    if (this.presentation()?.format !== 'markdown') return [];
    return parseDocumentText(this.source());
  });
}
