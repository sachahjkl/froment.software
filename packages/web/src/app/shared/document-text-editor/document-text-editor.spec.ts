import { TestBed } from '@angular/core/testing';
import {
  documentTextContent,
  isDocumentText,
  type DocumentTextPresentationValue,
} from '@froment/contracts';
import { describe, expect, it } from 'vitest';
import { DocumentTextEditor } from './document-text-editor';
import { documentTextContent as editorContent } from './document-text-content';

const setup = async (source = '') => {
  const fixture = TestBed.createComponent(DocumentTextEditor);
  fixture.componentRef.setInput('controlId', 'conditions');
  fixture.componentRef.setInput('label', 'Conditions');
  fixture.componentRef.setInput('value', source);
  const presentations: DocumentTextPresentationValue[] = [];
  fixture.componentInstance.presentationChange.subscribe((presentation) => {
    presentations.push(presentation);
    fixture.componentRef.setInput('presentation', presentation);
  });
  await fixture.whenStable();
  return { fixture, component: fixture.componentInstance, presentations };
};

describe('DocumentTextEditor', () => {
  it('does not reinterpret or change unformatted text when opened', async () => {
    const source = 'Texte **littéral** & <balise>.\n\nAutre paragraphe.';
    const { component, presentations } = await setup(source);
    expect(component.value()).toBe(source);
    expect(component['editor']?.getText()).toBe(source);
    expect(presentations).toEqual([]);
  });

  it('stores supported formatting and placement without HTML', async () => {
    const { fixture, component, presentations } = await setup();
    component['editor']?.commands.setContent({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Paiement' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'À réception', marks: [{ type: 'bold' }] }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Clause suivante', marks: [{ type: 'italic' }] }],
        },
      ],
    });
    await fixture.whenStable();
    component['changePlacement']('new-page');
    await fixture.whenStable();
    expect(isDocumentText(component.value())).toBe(true);
    expect(component.value()).toContain('**À réception**');
    expect(documentTextContent(component.value(), component.presentation())).toBe(
      'Paiement\n\nÀ réception\n\nClause suivante',
    );
    expect(presentations.at(-1)).toEqual({ format: 'markdown', placement: 'new-page' });
  });

  it('keeps literal punctuation when adding a page break to existing text', async () => {
    const source = 'A & B, **texte littéral**, <mot>.\n\nDeuxième paragraphe.';
    const { fixture, component } = await setup(source);
    component['changePlacement']('new-page');
    await fixture.whenStable();
    expect(documentTextContent(component.value(), component.presentation())).toBe(source);
  });

  it('locks editing and placement while disabled', async () => {
    const { fixture, component, presentations } = await setup('Original');
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    component['changePlacement']('new-page');
    expect(component['editor']?.isEditable).toBe(false);
    expect(component.value()).toBe('Original');
    expect(presentations).toEqual([]);
  });

  it.each([
    'A & B, &amp;, &#65;, &copy; et <mot>.',
    '# Titre littéral\n- Pas une liste\n1. Pas une liste numérotée',
    'https://example.test et [libellé](https://example.test)',
    'Une ligne\nLa suivante\n\nUn paragraphe.',
    '10. Première échéance\n20. Solde',
  ])('preserves literal text through serialization and reopening: %s', async (source) => {
    const { fixture, component } = await setup(source);
    component['commit']();
    await fixture.whenStable();
    component['changePlacement']('new-page');
    await fixture.whenStable();
    const markdown = component.value();
    const presentation = component.presentation();
    expect(isDocumentText(markdown)).toBe(true);
    expect(documentTextContent(markdown, presentation)).toBe(source);
    component['editor']?.commands.setContent(editorContent(markdown, 'markdown'), {
      emitUpdate: false,
    });
    expect(component['editor']?.getText()).toBe(source);
  });

  it('changes placement without converting literal conditions', async () => {
    const source = '10. Premier versement\n20. Solde\n\n\n\n**Texte littéral**';
    const { fixture, component, presentations } = await setup(source);
    component['changePlacement']('new-page');
    await fixture.whenStable();
    expect(component.value()).toBe(source);
    expect(presentations).toEqual([{ format: 'plain', placement: 'new-page' }]);
    expect(component['editor']?.getText()).toBe(source);
  });

  it('preserves overlapping bold and italic without HTML', async () => {
    const { fixture, component } = await setup();
    component['editor']?.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Premier ', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'second', marks: [{ type: 'bold' }, { type: 'italic' }] },
            { type: 'text', text: ' dernier', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    });
    await fixture.whenStable();
    const source = component.value();
    expect(isDocumentText(source)).toBe(true);
    expect(source).not.toContain('<');
    expect(editorContent(source, 'markdown')).toMatchObject({
      content: [
        {
          content: expect.arrayContaining([
            expect.objectContaining({
              text: 'second',
              marks: [{ type: 'bold' }, { type: 'italic' }],
            }),
            expect.objectContaining({ text: 'dernier', marks: [{ type: 'italic' }] }),
          ]),
        },
      ],
    });
  });

  it('preserves the first number of a structured list', async () => {
    const { fixture, component } = await setup();
    component['editor']?.commands.setContent(
      editorContent('10. Première échéance\n11. Solde', 'markdown'),
    );
    await fixture.whenStable();
    expect(component.value()).toContain('10. Première échéance');
    expect(editorContent(component.value(), 'markdown')).toMatchObject({
      content: [{ type: 'orderedList', attrs: { start: 10 } }],
    });
  });
});
