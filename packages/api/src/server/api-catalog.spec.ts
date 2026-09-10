import { expect, it } from 'vitest';
import { apiCatalog, apiCatalogContentType } from './api-catalog.js';

it('describes the OpenAPI contract and the API documentation', () => {
  const catalog = apiCatalog('https://example.test');
  expect(catalog.linkset).toHaveLength(1);
  expect(catalog.linkset[0]?.anchor).toBe('https://example.test/api');
  expect(catalog.linkset[0]?.['service-desc']).toEqual([
    {
      href: 'https://example.test/api/openapi.json',
      type: 'application/vnd.oai.openapi+json;version=3.1',
    },
  ]);
  expect(catalog.linkset[0]?.['service-doc']).toEqual([
    { href: 'https://example.test/api/docs', type: 'text/html' },
  ]);
  expect(apiCatalogContentType).toBe('application/linkset+json; charset=utf-8');
});
