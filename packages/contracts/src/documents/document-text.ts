import { Option, Schema } from 'effect';
import { Marked } from 'marked';
import { decodeHTMLStrict } from 'entities';

export const DocumentTextPresentation = Schema.Struct({
  format: Schema.Literals(['plain', 'markdown', 'blocks']),
  placement: Schema.Literals(['inline', 'new-page']),
});
export type DocumentTextPresentation = typeof DocumentTextPresentation.Type;

export const DocumentTextSpan = Schema.Struct({
  text: Schema.String,
  bold: Schema.Boolean,
  italic: Schema.Boolean,
});
export type DocumentTextSpan = typeof DocumentTextSpan.Type;

export type DocumentTextBlock =
  | { readonly kind: 'paragraph'; readonly spans: ReadonlyArray<DocumentTextSpan> }
  | {
      readonly kind: 'heading';
      readonly level: 2 | 3;
      readonly spans: ReadonlyArray<DocumentTextSpan>;
    }
  | {
      readonly kind: 'list';
      readonly ordered: boolean;
      readonly start: number;
      readonly items: ReadonlyArray<ReadonlyArray<DocumentTextBlock>>;
    };

export const DocumentTextBlock: Schema.Codec<DocumentTextBlock> = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('paragraph'), spans: Schema.Array(DocumentTextSpan) }),
  Schema.Struct({
    kind: Schema.Literal('heading'),
    level: Schema.Literals([2, 3]),
    spans: Schema.Array(DocumentTextSpan),
  }),
  Schema.Struct({
    kind: Schema.Literal('list'),
    ordered: Schema.Boolean,
    start: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
    items: Schema.Array(Schema.Array(Schema.suspend(() => DocumentTextBlock))),
  }),
]);

type InlineToken =
  | { readonly type: 'text' | 'escape'; readonly text: string }
  | { readonly type: 'br' }
  | { readonly type: 'strong' | 'em'; readonly tokens: ReadonlyArray<InlineToken> };
const InlineToken: Schema.Codec<InlineToken> = Schema.Union([
  Schema.Struct({ type: Schema.Literals(['text', 'escape']), text: Schema.String }),
  Schema.Struct({ type: Schema.Literal('br') }),
  Schema.Struct({
    type: Schema.Literals(['strong', 'em']),
    tokens: Schema.Array(Schema.suspend(() => InlineToken)),
  }),
]);
type BlockToken =
  | { readonly type: 'space' }
  | { readonly type: 'paragraph' | 'text'; readonly tokens: ReadonlyArray<InlineToken> }
  | { readonly type: 'heading'; readonly depth: 2 | 3; readonly tokens: ReadonlyArray<InlineToken> }
  | {
      readonly type: 'list';
      readonly ordered: boolean;
      readonly start: number | '';
      readonly items: ReadonlyArray<{ readonly tokens: ReadonlyArray<BlockToken> }>;
    };
const BlockToken: Schema.Codec<BlockToken> = Schema.Union([
  Schema.Struct({ type: Schema.Literal('space') }),
  Schema.Struct({
    type: Schema.Literals(['paragraph', 'text']),
    tokens: Schema.Array(InlineToken),
  }),
  Schema.Struct({
    type: Schema.Literal('heading'),
    depth: Schema.Literals([2, 3]),
    tokens: Schema.Array(InlineToken),
  }),
  Schema.Struct({
    type: Schema.Literal('list'),
    ordered: Schema.Boolean,
    start: Schema.Union([Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)), Schema.Literal('')]),
    items: Schema.Array(Schema.Struct({ tokens: Schema.Array(Schema.suspend(() => BlockToken)) })),
  }),
]);

const markdown = new Marked({ gfm: false, breaks: false, async: false });
const tokensSchema = Schema.Array(BlockToken);

const spans = (
  tokens: ReadonlyArray<InlineToken>,
  bold = false,
  italic = false,
): Array<DocumentTextSpan> =>
  tokens.flatMap((token) => {
    switch (token.type) {
      case 'text':
        return [{ text: decodeHTMLStrict(token.text), bold, italic }];
      case 'escape':
        return [{ text: token.text, bold, italic }];
      case 'br':
        return [{ text: '\n', bold, italic }];
      case 'strong':
        return spans(token.tokens, true, italic);
      case 'em':
        return spans(token.tokens, bold, true);
    }
  });

const blocks = (tokens: ReadonlyArray<BlockToken>): Array<DocumentTextBlock> =>
  tokens.flatMap((token): Array<DocumentTextBlock> => {
    switch (token.type) {
      case 'space':
        return [];
      case 'paragraph':
      case 'text':
        return [{ kind: 'paragraph', spans: spans(token.tokens) }];
      case 'heading':
        return [{ kind: 'heading', level: token.depth, spans: spans(token.tokens) }];
      case 'list':
        return [
          {
            kind: 'list',
            ordered: token.ordered,
            start: token.start === '' ? 1 : token.start,
            items: token.items.map((item) => blocks(item.tokens)),
          },
        ];
    }
  });

const storedBlocks = Schema.fromJsonString(Schema.Array(DocumentTextBlock));

export const serializeDocumentText = (content: ReadonlyArray<DocumentTextBlock>): string =>
  Schema.encodeSync(storedBlocks)(content);

export const parseDocumentText = (
  source: string,
  format: DocumentTextPresentation['format'] = 'markdown',
): ReadonlyArray<DocumentTextBlock> => {
  if (format === 'blocks') return Schema.decodeUnknownSync(storedBlocks)(source);
  if (format === 'plain')
    return source.split('\n\n').map((text) => ({
      kind: 'paragraph',
      spans: text.length === 0 ? [] : [{ text, bold: false, italic: false }],
    }));
  return blocks(Schema.decodeUnknownSync(tokensSchema)(markdown.lexer(source)));
};

export const isDocumentText = (
  source: string,
  format: DocumentTextPresentation['format'] = 'markdown',
): boolean => {
  if (format === 'plain') return true;
  if (format === 'blocks') return Option.isSome(Schema.decodeUnknownOption(storedBlocks)(source));
  return Option.isSome(Schema.decodeUnknownOption(tokensSchema)(markdown.lexer(source)));
};

export const documentTextContent = (
  source: string,
  presentation?: DocumentTextPresentation,
): string => {
  if (presentation === undefined || presentation.format === 'plain') return source;
  const text = (values: ReadonlyArray<DocumentTextBlock>): string =>
    values
      .map((block) => {
        if (block.kind === 'list') return block.items.map(text).join('\n');
        return block.spans.map((span) => span.text).join('');
      })
      .join('\n\n');
  return text(parseDocumentText(source, presentation.format));
};
