import { apiSchemaDocumentation, type ApiFieldDocumentation, type Language } from '@froment/l10n';
import { Predicate, type JsonSchema } from 'effect';
import type { OpenApi } from 'effect/unstable/httpapi';

export const describeSchema = (
  schema: JsonSchema.JsonSchema,
  language: Language,
  field?: string,
): JsonSchema.JsonSchema => {
  const result: JsonSchema.JsonSchema = { ...schema };
  const documentation = apiSchemaDocumentation[language];
  const fields: Readonly<Record<string, ApiFieldDocumentation>> = documentation.fields;
  const entry = fields[field ?? ''];
  if (entry !== undefined) {
    result['description'] = entry.description;
    if (entry.examples !== undefined) result['examples'] = entry.examples;
  }
  const properties = result['properties'];
  if (Predicate.isObject(properties))
    result['properties'] = Object.fromEntries(
      Object.entries(properties).map(([name, value]) => {
        if (Predicate.isObject(value)) return [name, describeSchema(value, language, name)];
        return [name, value];
      }),
    );
  for (const keyword of ['items', 'additionalProperties']) {
    const value = result[keyword];
    if (Predicate.isObject(value)) result[keyword] = describeSchema(value, language);
  }
  for (const keyword of ['anyOf', 'oneOf', 'allOf', 'prefixItems']) {
    const values = result[keyword];
    if (Array.isArray(values))
      result[keyword] = values.map((value) => {
        if (Predicate.isObject(value)) return describeSchema(value, language);
        return value;
      });
  }
  let values = result['enum'];
  if (Object.hasOwn(result, 'const')) values = [result['const']];
  if (
    Array.isArray(values) &&
    values.every(
      (value) =>
        Predicate.isString(value) ||
        Predicate.isNumber(value) ||
        Predicate.isBoolean(value) ||
        value === null,
    )
  ) {
    const previous = result['description'];
    const sections = [];
    if (Predicate.isString(previous)) sections.push(previous);
    sections.push(
      `${documentation.allowed}:\n${values.map((value) => `- \`${String(value)}\``).join('\n')}`,
    );
    result['description'] = sections.join('\n\n');
  }
  return result;
};

export const describeContent = (
  content: OpenApi.OpenApiSpecContent,
  language: Language,
): OpenApi.OpenApiSpecContent =>
  Object.fromEntries(
    Object.entries(content).map(([mediaType, value]) => [
      mediaType,
      { ...value, schema: describeSchema(value.schema, language) },
    ]),
  );
