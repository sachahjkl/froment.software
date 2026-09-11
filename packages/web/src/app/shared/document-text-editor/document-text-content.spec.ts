import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { documentTextContent as plainContent, isDocumentText } from '@froment/contracts';
import { describe, expect, it } from 'vitest';
import { documentTextContent, serializeEditorDocument } from './document-text-content';

const schema = getSchema([
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
]);
const presentation = { format: 'blocks', placement: 'inline' } as const;

describe('document text persistence', () => {
  it.each([
    '    Échéance à réception',
    '\tClause indentée',
    '\\&amp; et \\&copy;',
    'Avant\n\n\n\nAprès',
    '\n\nAvant\n\n',
    'Une ligne\n\n\n',
    'A & B, &amp;, &#65;, <mot>, **littéral** et [lien](https://example.test)',
  ])('preserves every literal character and empty paragraph: %s', (source) => {
    const document = schema.nodeFromJSON(documentTextContent(source, 'plain'));
    document.check();
    const saved = serializeEditorDocument(document);
    expect(isDocumentText(saved, 'blocks')).toBe(true);
    expect(plainContent(saved, presentation)).toBe(source);
    const reopened = schema.nodeFromJSON(documentTextContent(saved, 'blocks'));
    reopened.check();
    expect(reopened.eq(document)).toBe(true);
  });

  it('preserves heading breaks, crossed marks and nested ordered lists', () => {
    const document = schema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [
            { type: 'text', text: 'Avant' },
            { type: 'hardBreak' },
            { type: 'text', text: 'Après' },
          ],
        },
        { type: 'paragraph' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Premier ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'second', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: ' dernier', marks: [{ type: 'italic' }] },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 10 },
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Échéance' }] },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [
                        { type: 'paragraph', content: [{ type: 'text', text: 'Précision' }] },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    document.check();
    const saved = serializeEditorDocument(document);
    const reopened = schema.nodeFromJSON(documentTextContent(saved, 'blocks'));
    reopened.check();
    expect(reopened.eq(document)).toBe(true);
  });

  it('reads existing Markdown without changing its source', () => {
    const source = '## Paiement\n\n**À réception**\n\n10. Échéance\n11. Solde';
    const document = schema.nodeFromJSON(documentTextContent(source, 'markdown'));
    document.check();
    expect(plainContent(serializeEditorDocument(document), presentation)).toBe(
      plainContent(source, { format: 'markdown', placement: 'inline' }),
    );
  });
});
