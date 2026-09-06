import { describe, expect, it } from 'vitest';
import { startHttpTestServer } from '../server/server.spec-helper.js';

describe('documentation language negotiation', () => {
  it('uses Accept-Language on default routes and keeps explicit language routes stable', async () => {
    const server = await startHttpTestServer();
    try {
      const headers = { 'accept-language': 'en-GB;q=1,fr;q=0.2' };
      const docs = await fetch(`${server.baseUrl}/api/docs`, { headers, redirect: 'manual' });
      expect(docs.status).toBe(302);
      expect(docs.headers.get('location')).toBe('/api/docs/en');
      expect(docs.headers.get('vary')).toContain('Accept-Language');
      for (const language of ['fr', 'en']) {
        const response = await fetch(`${server.baseUrl}/api/docs/${language}`, { headers });
        const html = await response.text();
        expect(response.headers.get('content-language')).toBe(language);
        expect(html).toContain(`<html lang="${language}">`);
        expect(html).toContain(`localization: { locale: '${language}' }`);
        expect(html).toContain(`/api/openapi.${language}.json`);
        expect(html).toContain('/scalar/standalone.js');
        expect(html).not.toContain('cdn.jsdelivr.net');
      }
      const api = await fetch(`${server.baseUrl}/api/openapi.json`, { headers });
      expect(api.status).toBe(200);
      expect(api.headers.get('content-language')).toBe('en');
      expect(api.headers.get('vary')).toContain('Accept-Language');
      expect(await api.text()).toContain('List bank transactions');
      const french = await fetch(`${server.baseUrl}/api/openapi.fr.json`, { headers });
      expect(await french.text()).toContain('Lister les opérations bancaires');
    } finally {
      await server.close();
    }
  }, 20000);
});
