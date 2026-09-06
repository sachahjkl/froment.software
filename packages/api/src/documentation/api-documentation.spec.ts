import {
  Api,
  InvoiceCreateRequest,
  InvoicePaymentRequest,
  InvoicePaymentCancelRequest,
  BankImportRequest,
  BankMatchRequest,
  BankUnmatchRequest,
  IntegrationSubmission,
} from '@froment/contracts';
import { apiDocumentation, apiRequestExamples, type Language } from '@froment/l10n';
import { Schema, type JsonSchema } from 'effect';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';

import { apiForLanguage } from './api-documentation.js';

const specification = OpenApi.fromApi(Api);
const operations = Object.values(specification.paths).flatMap((path) =>
  Object.values(path).filter(
    (operation): operation is OpenApi.OpenAPISpecOperation => operation !== undefined,
  ),
);
const operationIds = operations.map(({ operationId }) => operationId).sort();
const groupIds = [...new Set(operations.flatMap(({ tags }) => tags))].sort();

describe('API documentation', () => {
  for (const language of ['fr', 'en'] satisfies ReadonlyArray<Language>) {
    it(`documents every operation in ${language}`, () => {
      expect(Object.keys(apiDocumentation[language].operations).sort()).toEqual(operationIds);
    });

    it(`documents every group in ${language}`, () => {
      expect(Object.keys(apiDocumentation[language].groups).sort()).toEqual(groupIds);
    });
  }

  it('localizes prose without changing paths or schemas', () => {
    const french = OpenApi.fromApi(apiForLanguage('fr'));
    const english = OpenApi.fromApi(apiForLanguage('en'));

    expect(french.info).toMatchObject({
      title: 'API Froment Software',
      description: 'API pour les clients, devis, commandes, factures et documents générés.',
    });
    expect(french.paths['/api/clients']?.get).toMatchObject({
      operationId: 'clientList',
      summary: 'Lister les clients',
      description: expect.stringContaining('Permission requise : `client.read`.'),
    });
    expect(english.paths['/api/clients']?.get).toMatchObject({
      operationId: 'clientList',
      summary: 'List clients',
      description: expect.stringContaining('Required permission: `client.read`.'),
    });
    expect(french.paths['/api/auth/login']?.post?.tags).toEqual(['Authentification', 'Frontend']);
    expect(french.tags).toContainEqual({
      name: 'Frontend',
      description: 'Routes utilisées par le frontend Froment Software.',
    });
    expect(Object.keys(french.paths)).toEqual(Object.keys(english.paths));
    const validationOnly = (value: JsonSchema.Definitions): string =>
      JSON.stringify(value, (key, item) => {
        if (key === 'description' || key === 'examples') return undefined;
        return item;
      });
    expect(validationOnly(french.components.schemas)).toEqual(
      validationOnly(english.components.schemas),
    );
    expect(validationOnly(french.components.schemas)).toEqual(
      validationOnly(specification.components.schemas),
    );
    for (const [path, methods] of Object.entries(specification.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        const localized = Object.entries(french.paths[path] ?? {}).find(
          ([name]) => name === method,
        )?.[1];
        expect(localized).toBeDefined();
        if (
          operation === undefined ||
          localized === undefined ||
          Array.isArray(operation) ||
          Array.isArray(localized)
        )
          continue;
        expect(validationOnly({ parameters: { values: localized.parameters } })).toEqual(
          validationOnly({ parameters: { values: operation.parameters } }),
        );
        expect(validationOnly({ content: { value: localized.requestBody?.content } })).toEqual(
          validationOnly({ content: { value: operation.requestBody?.content } }),
        );
        expect(validationOnly({ responses: localized.responses })).toEqual(
          validationOnly({ responses: operation.responses }),
        );
      }
    }
    expect(JSON.stringify(specification)).not.toContain('List clients');
    expect(JSON.stringify(specification)).not.toContain('Client records and lifecycle.');
  });
  it('publishes examples that pass the real request schemas', () => {
    const schemas = {
      invoiceCreate: InvoiceCreateRequest,
      invoicePaymentCreate: InvoicePaymentRequest,
      invoicePaymentCancel: InvoicePaymentCancelRequest,
      bankImport: BankImportRequest,
      bankMatch: BankMatchRequest,
      bankUnmatch: BankUnmatchRequest,
      integrationOperationCreate: IntegrationSubmission,
    };
    for (const [operation, schema] of Object.entries(schemas)) {
      expect(() =>
        Schema.decodeUnknownSync(schema)(
          new Map(Object.entries(apiRequestExamples)).get(operation),
        ),
      ).not.toThrow();
      expect(operationIds).toContain(operation);
    }
  });
  it('shows permission requirements as Scalar note alerts', () => {
    const english = OpenApi.fromApi(apiForLanguage('en'));
    expect(english.paths['/api/banking/transactions']?.get?.description).toContain('> [!note]');
    expect(english.paths['/api/banking/transactions']?.get?.description).toContain('`bank.read`');
    expect(english.paths['/api/banking/transactions']?.get?.description).toContain(
      'All permissions',
    );
  });
});
