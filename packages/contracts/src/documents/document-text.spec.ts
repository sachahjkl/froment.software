import { Schema } from 'effect';
import { describe, expect, it } from 'vitest';
import { QuoteCreateRequest } from '../quotes/contracts.js';
import { QuoteConditionPresetWriteRequest } from '../quote-condition-presets/contracts.js';
import {
  DocumentTextPresentation,
  documentTextContent,
  isDocumentText,
  parseDocumentText,
  serializeDocumentText,
} from './document-text.js';

const presentation = { format: 'markdown', placement: 'new-page' } as const;

describe('document text', () => {
  it('stores typed blocks without interpreting literal text or empty paragraphs', () => {
    const content = [
      { kind: 'heading', level: 2, spans: [{ text: 'Avant\nAprès', bold: false, italic: false }] },
      { kind: 'paragraph', spans: [] },
      { kind: 'paragraph', spans: [{ text: '    \\&amp;', bold: true, italic: true }] },
    ] as const;
    const source = serializeDocumentText(content);
    expect(parseDocumentText(source, 'blocks')).toEqual(content);
    expect(documentTextContent(source, { format: 'blocks', placement: 'inline' })).toBe(
      'Avant\nAprès\n\n\n\n    \\&amp;',
    );
  });

  it('validates block structure and retains the 2000-character stored-text limit', () => {
    const presentation = { format: 'blocks', placement: 'inline' } as const;
    const source = serializeDocumentText([
      { kind: 'paragraph', spans: [{ text: '', bold: false, italic: false }] },
    ]);
    const conditions = serializeDocumentText([
      {
        kind: 'paragraph',
        spans: [{ text: 'x'.repeat(2000 - source.length), bold: false, italic: false }],
      },
    ]);
    expect(conditions.length).toBe(2000);
    expect(
      Schema.is(QuoteConditionPresetWriteRequest)({
        name: 'Conditions',
        conditions,
        conditionsPresentation: presentation,
      }),
    ).toBe(true);
    expect(
      Schema.is(QuoteConditionPresetWriteRequest)({
        name: 'Conditions',
        conditions: conditions + ' ',
        conditionsPresentation: presentation,
      }),
    ).toBe(false);
    expect(isDocumentText('[{"kind":"html","text":"<b>Clause</b>"}]', 'blocks')).toBe(false);
    expect(isDocumentText('not JSON', 'blocks')).toBe(false);
    expect(
      Schema.is(QuoteConditionPresetWriteRequest)({
        name: 'Conditions',
        conditions: serializeDocumentText([{ kind: 'paragraph', spans: [] }]),
        conditionsPresentation: presentation,
      }),
    ).toBe(false);
  });

  it('keeps paragraphs, emphasis, headings and nested lists', () => {
    const source =
      '## Paiement\n\nPremier **paragraphe** et *précision*.\n\nSecond paragraphe.\n\n1. Première clause\n2. Deuxième clause\n   - Détail';
    const content = parseDocumentText(source);
    expect(content.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'paragraph',
      'list',
    ]);
    expect(content[1]).toMatchObject({
      spans: expect.arrayContaining([
        { text: 'paragraphe', bold: true, italic: false },
        { text: 'précision', bold: false, italic: true },
      ]),
    });
    expect(content[3]).toMatchObject({
      ordered: true,
      start: 1,
      items: [
        expect.any(Array),
        expect.arrayContaining([expect.objectContaining({ kind: 'list' })]),
      ],
    });
    expect(documentTextContent(source, presentation)).not.toContain('**');
  });

  it('keeps unformatted text literal', () => {
    const source = '**Texte original**\n\n<ne pas interpréter>';
    expect(documentTextContent(source)).toBe(source);
    expect(documentTextContent(source, { format: 'plain', placement: 'new-page' })).toBe(source);
  });

  it('rejects a preset with an empty formatted heading', () => {
    expect(() =>
      Schema.decodeUnknownSync(QuoteConditionPresetWriteRequest)({
        name: 'Conditions',
        conditions: '## ',
        conditionsPresentation: presentation,
      }),
    ).toThrow();
  });

  it('keeps hard breaks and escaped punctuation', () => {
    expect(documentTextContent('Première ligne  \nDeuxième \\*ligne\\*', presentation)).toBe(
      'Première ligne\nDeuxième *ligne*',
    );
  });

  it.each([
    '<script>alert(1)</script>',
    '![image](https://example.test/a.png)',
    '[lien](javascript:alert(1))',
    '```typst\n#read("secret")\n```',
    '# Titre principal',
  ])('rejects unsupported markup: %s', (source) => {
    expect(isDocumentText(source)).toBe(false);
    expect(() => parseDocumentText(source)).toThrow();
  });

  it('validates the format and placement', () => {
    expect(Schema.decodeUnknownSync(DocumentTextPresentation)(presentation)).toEqual(presentation);
    expect(() =>
      Schema.decodeUnknownSync(DocumentTextPresentation)({
        ...presentation,
        placement: 'second-page',
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(DocumentTextPresentation)({ ...presentation, format: 'html' }),
    ).toThrow();
  });

  it('validates formatted text at the request boundary', () => {
    const request = {
      clientId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      currency: 'EUR',
      title: 'Prestation',
      conditions: '**À réception**',
      conditionsPresentation: presentation,
      lines: [
        { description: 'Travail', quantityMilli: 1000, unitPriceCents: 100, vatRateBasisPoints: 0 },
      ],
    };
    expect(Schema.decodeUnknownSync(QuoteCreateRequest)(request)).toEqual(request);
    expect(() =>
      Schema.decodeUnknownSync(QuoteCreateRequest)({ ...request, conditions: '<b>HTML</b>' }),
    ).toThrow();
  });
});
