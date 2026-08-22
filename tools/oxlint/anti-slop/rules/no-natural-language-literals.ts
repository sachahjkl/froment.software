import { defineRule } from '@oxlint/plugins';

import type { ESTree } from '@oxlint/plugins';

const NATURAL_LANGUAGE = /\p{L}[\p{L}\p{N}'’.-]*\s+\p{L}/u;
const SQL = /^\s*(?:alter|begin|create|delete|drop|end|explain|insert|pragma|replace|select|update|with)\b/iu;
const PROTOCOL_VALUE = /^(?:Bearer |Cookie, Authorization$|attachment; filename=|default-src |inline; filename=)/u;

function isSelectorArgument(node: ESTree.Node): boolean {
  const parent = node.parent;
  if (parent?.type !== 'CallExpression' || parent.arguments[0] !== node) return false;
  const callee = parent.callee;
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    ['closest', 'matches', 'querySelector', 'querySelectorAll'].includes(callee.property.name)
  );
}

function isModuleSpecifier(node: ESTree.Node): boolean {
  const parent = node.parent;
  return (
    (parent?.type === 'ImportDeclaration' && parent.source === node) ||
    (parent?.type === 'ExportAllDeclaration' && parent.source === node) ||
    (parent?.type === 'ExportNamedDeclaration' && parent.source === node)
  );
}

function isPropertyKey(node: ESTree.Node): boolean {
  const parent = node.parent;
  return parent?.type === 'Property' && parent.key === node && !parent.computed;
}

function isEmbeddedSource(node: ESTree.Node): boolean {
  const parent = node.parent;
  if (parent?.type !== 'Property' || parent.value !== node || parent.computed) return false;
  const key = parent.key;
  return (
    key.type === 'Identifier' && ['styles', 'template'].includes(key.name)
  );
}

function isSqlSource(node: ESTree.Node): boolean {
  const parent = node.parent;
  if (
    parent?.type === 'TaggedTemplateExpression' &&
    parent.tag.type === 'Identifier' &&
    parent.tag.name === 'sql'
  ) {
    return true;
  }
  if (parent?.type !== 'CallExpression' || !parent.arguments.some((argument) => argument === node)) {
    return false;
  }
  const callee = parent.callee;
  return (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.property.type === 'Identifier' &&
    ['exec', 'prepare', 'pragma'].includes(callee.property.name)
  );
}

function isAllowed(value: string, node: ESTree.Node): boolean {
  const trimmed = value.trim();
  return (
    !NATURAL_LANGUAGE.test(value) ||
    SQL.test(value) ||
    trimmed === 'no action' ||
    PROTOCOL_VALUE.test(trimmed) ||
    trimmed.startsWith('/') ||
    isModuleSpecifier(node) ||
    isPropertyKey(node) ||
    isEmbeddedSource(node) ||
    isSqlSource(node) ||
    isSelectorArgument(node)
  );
}

/** Reject prose literals in active source while retaining machine and integration values. */
export const noNaturalLanguageLiteralsRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow natural-language literals outside localization and test sources.',
    },
    messages: {
      naturalLanguage:
        'Move prose to the localization package, or replace runtime diagnostics with a stable machine code.',
    },
  },
  createOnce(context) {
    const report = (node: ESTree.Node, value: string) => {
      if (!isAllowed(value, node)) context.report({ node, messageId: 'naturalLanguage' });
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string') report(node, node.value);
      },
      TemplateLiteral(node) {
        report(
          node,
          node.quasis.map((quasi) => quasi.value.raw).join(''),
        );
      },
    };
  },
});
