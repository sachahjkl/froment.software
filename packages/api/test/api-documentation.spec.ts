import { Api } from '@froment/contracts';
import { apiDocumentation, type Language } from '@froment/l10n';
import { OpenApi } from 'effect/unstable/httpapi';
import { describe, expect, it } from 'vitest';

const specification = OpenApi.fromApi(Api);
const operations = Object.values(specification.paths).flatMap((path) =>
  Object.values(path).filter(
    (operation): operation is OpenApi.OpenAPISpecOperation => operation !== undefined,
  ),
);
const operationIds = operations.map(({ operationId }) => operationId).sort();
const groupIds = [...new Set(operations.flatMap(({ tags }) => tags))].sort();

describe('API documentation translations', () => {
  for (const language of ['fr', 'en'] satisfies ReadonlyArray<Language>) {
    it(`documents every operation in ${language}`, () => {
      expect(Object.keys(apiDocumentation[language].operations).sort()).toEqual(operationIds);
    });

    it(`documents every group in ${language}`, () => {
      expect(Object.keys(apiDocumentation[language].groups).sort()).toEqual(groupIds);
    });
  }
});
