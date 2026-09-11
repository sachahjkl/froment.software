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
    const format = this.presentation()?.format ?? 'plain';
    if (format === 'plain') return [];
    return parseDocumentText(this.source(), format);
  });
  protected readonly formatted = computed(
    () => this.blocks() !== undefined || (this.presentation()?.format ?? 'plain') !== 'plain',
  );
}
