import { Predicate, type JsonSchema } from 'effect';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';
import { apiForLanguage } from './api-documentation.js';
import { describeSchema } from './schema-documentation.js';

describe('schema documentation', () => {
  it('keeps restrictions and nullability while documenting fields and every enum value', () => {
    const input = {
      type: 'object',
      required: ['method', 'amountCents'],
      additionalProperties: false,
      properties: {
        currency: { type: 'string', const: 'EUR' },
        method: { type: 'string', enum: ['transfer', 'card', 'cash', 'cheque', 'other'] },
        amountCents: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
        cancelledAt: { anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }] },
      },
    };
    const result = describeSchema(input, 'fr');
    expect(result).toMatchObject(input);
    expect(result['properties']).toMatchObject({
      currency: { const: 'EUR', description: 'Valeurs autorisées:\n- `EUR`' },
      method: {
        description: 'Valeurs autorisées:\n- `transfer`\n- `card`\n- `cash`\n- `cheque`\n- `other`',
      },
      amountCents: { examples: [12500], description: expect.stringContaining('centimes') },
    });
    expect(input.properties.amountCents).not.toHaveProperty('description');
  });

  it('documents the values of every enumeration in the generated API', () => {
    const specification = OpenApi.fromApi(apiForLanguage('en'));
    let count = 0;
    const visit = (node: JsonSchema.JsonSchema): void => {
      let enumeration = node['enum'];
      if (Object.hasOwn(node, 'const')) enumeration = [node['const']];
      if (Array.isArray(enumeration)) {
        count++;
        for (const value of enumeration)
          expect(node['description']).toContain(`\`${String(value)}\``);
      }
      for (const value of Object.values(node)) {
        if (Predicate.isObject(value)) visit(value);
        if (Array.isArray(value))
          for (const item of value) if (Predicate.isObject(item)) visit(item);
      }
    };
    visit({ ...specification });
    expect(count).toBeGreaterThan(20);
  });
});
