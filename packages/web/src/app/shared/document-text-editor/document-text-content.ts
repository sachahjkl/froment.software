import {
  parseDocumentText,
  serializeDocumentText,
  type DocumentTextBlock,
  type DocumentTextPresentationValue,
  type DocumentTextSpan,
} from '@froment/contracts';
import type { Editor, JSONContent } from '@tiptap/core';
import { Schema } from 'effect';

type EditorNode = Editor['state']['doc'];

const editorBlocks = (parent: EditorNode): DocumentTextBlock[] => {
  const blocks: DocumentTextBlock[] = [];
  parent.forEach((node) => {
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      const items: DocumentTextBlock[][] = [];
      node.forEach((item) => items.push(editorBlocks(item)));
      blocks.push({
        kind: 'list',
        ordered: node.type.name === 'orderedList',
        start:
          node.type.name === 'orderedList'
            ? Schema.decodeUnknownSync(Schema.Int)(node.attrs['start'])
            : 1,
        items,
      });
      return;
    }
    const spans: DocumentTextSpan[] = [];
    node.forEach((child) => {
      spans.push({
        text: child.type.name === 'hardBreak' ? '\n' : child.textContent,
        bold: child.marks.some((mark) => mark.type.name === 'bold'),
        italic: child.marks.some((mark) => mark.type.name === 'italic'),
      });
    });
    if (node.type.name === 'heading') {
      blocks.push({
        kind: 'heading',
        level: Schema.decodeUnknownSync(Schema.Literals([2, 3]))(node.attrs['level']),
        spans,
      });
    } else if (node.type.name === 'paragraph') {
      blocks.push({ kind: 'paragraph', spans });
    } else {
      throw new Error('document.text.node.invalid');
    }
  });
  return blocks;
};

export const serializeEditorDocument = (document: EditorNode): string =>
  serializeDocumentText(editorBlocks(document));

const inlineContent = (spans: ReadonlyArray<DocumentTextSpan>): JSONContent[] =>
  spans.flatMap((span) => {
    const marks: JSONContent['marks'] = [];
    if (span.bold) marks.push({ type: 'bold' });
    if (span.italic) marks.push({ type: 'italic' });
    return span.text
      .split('\n')
      .flatMap((text, index): JSONContent[] => [
        ...(index === 0 ? [] : [{ type: 'hardBreak', marks }]),
        ...(text.length === 0 ? [] : [{ type: 'text', text, marks }]),
      ]);
  });

const blockContent = (blocks: ReadonlyArray<DocumentTextBlock>): JSONContent[] =>
  blocks.map((block) => {
    if (block.kind === 'list')
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        attrs: { start: block.start },
        content: block.items.map((item) => ({ type: 'listItem', content: blockContent(item) })),
      };
    if (block.kind === 'heading')
      return {
        type: 'heading',
        attrs: { level: block.level },
        content: inlineContent(block.spans),
      };
    return { type: 'paragraph', content: inlineContent(block.spans) };
  });

export const documentTextContent = (
  source: string,
  format: DocumentTextPresentationValue['format'],
): JSONContent => ({
  type: 'doc',
  content: blockContent(parseDocumentText(source, format)),
});
