import { Api } from '@froment/contracts';
import { apiDocumentation, type Language } from '@froment/l10n';
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
      title: 'API d’intégration Froment Software',
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
    expect(french.components.schemas).toEqual(english.components.schemas);
    expect(JSON.stringify(specification)).not.toContain('List clients');
    expect(JSON.stringify(specification)).not.toContain('Client records and lifecycle.');
  });
});
