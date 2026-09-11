import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import type { DocumentTextPresentationValue } from '@froment/contracts';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { documentTextContent, documentTextSerializer } from './document-text-content';

type TextAction =
  | 'paragraph'
  | 'heading'
  | 'subheading'
  | 'bold'
  | 'italic'
  | 'bulletList'
  | 'orderedList'
  | 'undo'
  | 'redo';
const actions: ReadonlyArray<{ readonly action: TextAction; readonly label: TranslationKey }> = [
  { action: 'paragraph', label: 'documentText.paragraph' },
  { action: 'heading', label: 'documentText.heading' },
  { action: 'subheading', label: 'documentText.subheading' },
  { action: 'bold', label: 'documentText.bold' },
  { action: 'italic', label: 'documentText.italic' },
  { action: 'bulletList', label: 'documentText.bulletList' },
  { action: 'orderedList', label: 'documentText.orderedList' },
  { action: 'undo', label: 'documentText.undo' },
  { action: 'redo', label: 'documentText.redo' },
];

@Component({
  imports: [Button],
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-document-text-editor',
  styleUrl: './document-text-editor.scss',
  templateUrl: './document-text-editor.html',
})
export class DocumentTextEditor implements FormValueControl<string> {
  readonly value = model('');
  readonly presentation = input<DocumentTextPresentationValue>();
  readonly presentationChange = output<DocumentTextPresentationValue>();
  readonly label = input.required<string>();
  readonly controlId = input.required<string>();
  readonly descriptionId = input('');
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly touch = output<void>();
  protected readonly i18n = inject(I18nService);
  protected readonly placements = [
    { value: 'inline', label: 'documentText.inline' },
    { value: 'new-page', label: 'documentText.newPage' },
  ] as const;
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('editorHost');
  private readonly destroyRef = inject(DestroyRef);
  private readonly transaction = signal(0);
  private editor: Editor | undefined;
  private renderedSource = '';
  private renderedFormat: 'plain' | 'markdown' = 'plain';
  protected readonly placement = computed(() => this.presentation()?.placement ?? 'inline');
  protected readonly toolbar = computed(() => {
    this.transaction();
    return actions.map((item) => ({
      ...item,
      pressed: this.pressed(item.action),
      disabled: this.actionDisabled(item.action),
    }));
  });

  constructor() {
    afterRenderEffect(() => {
      const source = this.value();
      const format = this.presentation()?.format ?? 'plain';
      const disabled = this.disabled();
      const attributes = {
        id: this.controlId(),
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-labelledby': `${this.controlId()}-label`,
        'aria-describedby': this.descriptionId(),
        'aria-invalid': String(this.invalid() && this.touched()),
        'aria-disabled': String(disabled),
        class: 'document-text-input',
      };
      if (!this.editor) {
        this.renderedSource = source;
        this.renderedFormat = format;
        this.editor = new Editor({
          element: this.container().nativeElement,
          injectCSS: false,
          editable: !disabled,
          extensions: [
            StarterKit.configure({
              heading: { levels: [2, 3] },
              blockquote: false,
              code: false,
              codeBlock: false,
              horizontalRule: false,
              link: false,
              strike: false,
              underline: false,
              trailingNode: false,
              dropcursor: false,
              gapcursor: false,
            }),
          ],
          content: documentTextContent(source, format),
          editorProps: { attributes },
          onUpdate: () => this.commit(),
          onBlur: () => this.touch.emit(),
          onTransaction: () => this.transaction.update((value) => value + 1),
        });
        this.transaction.update((value) => value + 1);
      } else {
        if (source !== this.renderedSource || format !== this.renderedFormat) {
          this.renderedSource = source;
          this.renderedFormat = format;
          this.editor.commands.setContent(documentTextContent(source, format), {
            emitUpdate: false,
          });
        }
        this.editor.setEditable(!disabled, false);
        this.editor.setOptions({ editorProps: { attributes } });
      }
    });
    this.destroyRef.onDestroy(() => this.editor?.destroy());
  }

  focus(): void {
    this.editor?.commands.focus();
  }

  private commit(placement = this.placement()): void {
    if (!this.editor || this.disabled()) return;
    const source = documentTextSerializer.serialize(this.editor.state.doc);
    this.renderedSource = source;
    this.renderedFormat = 'markdown';
    this.value.set(source);
    this.presentationChange.emit({ format: 'markdown', placement });
  }

  protected changePlacement(value: string): void {
    if (this.disabled() || (value !== 'inline' && value !== 'new-page')) return;
    this.presentationChange.emit({
      format: this.presentation()?.format ?? 'plain',
      placement: value,
    });
  }

  private pressed(action: TextAction): boolean | null {
    if (action === 'undo' || action === 'redo') return null;
    if (!this.editor) return false;
    if (action === 'heading') return this.editor.isActive('heading', { level: 2 });
    if (action === 'subheading') return this.editor.isActive('heading', { level: 3 });
    return this.editor.isActive(action);
  }

  private actionDisabled(action: TextAction): boolean {
    if (this.disabled() || !this.editor) return true;
    if (action === 'undo') return !this.editor.can().undo();
    if (action === 'redo') return !this.editor.can().redo();
    return false;
  }

  protected apply(action: TextAction): void {
    if (this.actionDisabled(action) || !this.editor) return;
    const command = this.editor.chain().focus();
    switch (action) {
      case 'paragraph':
        command.setParagraph().run();
        break;
      case 'heading':
        command.toggleHeading({ level: 2 }).run();
        break;
      case 'subheading':
        command.toggleHeading({ level: 3 }).run();
        break;
      case 'bold':
        command.toggleBold().run();
        break;
      case 'italic':
        command.toggleItalic().run();
        break;
      case 'bulletList':
        command.toggleBulletList().run();
        break;
      case 'orderedList':
        command.toggleOrderedList().run();
        break;
      case 'undo':
        command.undo().run();
        break;
      case 'redo':
        command.redo().run();
        break;
    }
  }
}
