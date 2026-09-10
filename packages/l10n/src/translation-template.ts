type TranslationNode =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'parameter'; readonly name: string };

export function compileTranslationTemplate(source: string): readonly TranslationNode[] {
  const nodes: TranslationNode[] = [];
  let textStart = 0;
  let parameterStart = -1;
  for (let position = 0; position < source.length; position += 1) {
    if (source[position] === '{') {
      parameterStart = position;
    } else if (source[position] === '}') {
      if (parameterStart >= textStart && parameterStart + 1 < position) {
        if (parameterStart > textStart) {
          nodes.push({ kind: 'text', value: source.slice(textStart, parameterStart) });
        }
        nodes.push({ kind: 'parameter', name: source.slice(parameterStart + 1, position) });
        textStart = position + 1;
      }
      parameterStart = -1;
    }
  }
  if (textStart < source.length) nodes.push({ kind: 'text', value: source.slice(textStart) });
  return nodes;
}

export function renderTranslationTemplate(
  nodes: readonly TranslationNode[],
  params: Readonly<Record<string, string | number>>,
): string {
  return nodes
    .map((node) => {
      if (node.kind === 'text') return node.value;
      return Object.hasOwn(params, node.name) ? String(params[node.name]) : `{${node.name}}`;
    })
    .join('');
}
