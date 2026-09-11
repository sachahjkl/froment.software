import {
  parseDocumentText,
  type DocumentTextBlock,
  type DocumentTextSpan,
} from '@froment/contracts';
import type { JSONContent } from '@tiptap/core';
import { defaultMarkdownSerializer, MarkdownSerializer } from 'prosemirror-markdown';
import { Schema } from 'effect';

export const documentTextSerializer = new MarkdownSerializer(
  {
    paragraph: defaultMarkdownSerializer.nodes['paragraph']!,
    heading: defaultMarkdownSerializer.nodes['heading']!,
    bulletList: defaultMarkdownSerializer.nodes['bullet_list']!,
    orderedList: (state, node) => {
      const start = Schema.decodeUnknownSync(Schema.Int)(node.attrs['start']);
      const width = String(start + node.childCount - 1).length;
      state.renderList(
        node,
        ' '.repeat(width + 2),
        (index) => `${String(start + index).padStart(width)}. `,
      );
    },
    listItem: defaultMarkdownSerializer.nodes['list_item']!,
    hardBreak: defaultMarkdownSerializer.nodes['hard_break']!,
    text: defaultMarkdownSerializer.nodes['text']!,
  },
  {
    bold: defaultMarkdownSerializer.marks['strong']!,
    italic: defaultMarkdownSerializer.marks['em']!,
  },
  { hardBreakNodeName: 'hardBreak', escapeExtraCharacters: /(?<!\\)[<>&#+.!=()-]/g },
);

const inlineContent = (spans: ReadonlyArray<DocumentTextSpan>): JSONContent[] =>
  spans.flatMap((span) => {
    const marks: JSONContent['marks'] = [];
    if (span.bold) marks.push({ type: 'bold' });
    if (span.italic) marks.push({ type: 'italic' });
    return span.text
      .split('\n')
      .flatMap((text, index): JSONContent[] => [
        ...(index === 0 ? [] : [{ type: 'hardBreak' }]),
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

export const documentTextContent = (source: string, format: 'plain' | 'markdown'): JSONContent => ({
  type: 'doc',
  content:
    format === 'markdown'
      ? blockContent(parseDocumentText(source))
      : source.split('\n\n').map((text) => ({
          type: 'paragraph',
          content: inlineContent([{ text, bold: false, italic: false }]),
        })),
});
