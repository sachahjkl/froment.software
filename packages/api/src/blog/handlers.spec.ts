/// <reference lib="dom" />
// @vitest-environment jsdom

import { Api, ApiTelemetry, BlogApi } from '@froment/contracts';
import { translate } from '@froment/l10n';
import { blogPosts } from '@froment/l10n/blog-posts';
import { Layer } from 'effect';
import { HttpRouter, HttpServer } from 'effect/unstable/http';
import { HttpApi, HttpApiBuilder, OpenApi } from 'effect/unstable/httpapi';
import { expect, it } from 'vitest';
import { blogHandlers } from './handlers.js';

it('serves the shared blog entries as public French Atom XML', async () => {
  const origin = 'https://example.test';
  const testApi = HttpApi.make('froment-api').add(BlogApi).middleware(ApiTelemetry);
  const handlers = blogHandlers(origin).pipe(
    Layer.provide(
      Layer.succeed(
        ApiTelemetry,
        ApiTelemetry.of((httpEffect) => httpEffect),
      ),
    ),
  );
  const routes = HttpApiBuilder.layer(testApi).pipe(
    Layer.provide(handlers),
    Layer.provide(HttpServer.layerServices),
  );
  const server = HttpRouter.toWebHandler(routes, { disableLogger: true });
  try {
    const response = await server.handler(
      new Request('http://localhost/api/blog/feed', { headers: { 'accept-language': 'en' } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/atom+xml');
    expect(response.headers.get('content-language')).toBe('fr');
    expect(response.headers.get('cache-control')).toBe('no-cache');
    const document = new DOMParser().parseFromString(await response.text(), 'application/xml');
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.namespaceURI).toBe('http://www.w3.org/2005/Atom');
    expect(document.documentElement.getAttribute('xml:lang')).toBe('fr');
    expect(document.querySelector('feed > id')?.textContent).toBe(`${origin}/api/blog/feed`);
    expect(document.querySelector('feed > title')?.textContent).toBeTruthy();
    expect(document.querySelector('feed > author > name')?.textContent).toBe(
      translate('fr', 'metadata.author'),
    );
    expect(document.querySelector('feed > link[rel="self"]')?.getAttribute('href')).toBe(
      `${origin}/api/blog/feed`,
    );
    expect(document.querySelector('feed > updated')?.textContent).toBe(
      `${blogPosts
        .map((post) => post.updated)
        .sort()
        .at(-1)}T00:00:00Z`,
    );
    const entries = Array.from(document.querySelectorAll('feed > entry'));
    expect(entries).toHaveLength(blogPosts.length);
    expect(new Set(entries.map((entry) => entry.querySelector('id')?.textContent)).size).toBe(
      blogPosts.length,
    );
    for (const post of blogPosts) {
      const url = `${origin}/blog/${post.slug}`;
      const entry = entries.find((candidate) => candidate.querySelector('id')?.textContent === url);
      expect(entry?.querySelector('title')?.textContent).toBe(translate('fr', post.titleKey));
      expect(entry?.querySelector('summary')?.textContent).toBe(
        translate('fr', post.descriptionKey),
      );
      expect(entry?.querySelector('published')?.textContent).toBe(`${post.published}T00:00:00Z`);
      expect(entry?.querySelector('updated')?.textContent).toBe(`${post.updated}T00:00:00Z`);
      expect(entry?.querySelector('link[rel="alternate"]')?.getAttribute('href')).toBe(url);
      expect(
        Array.from(entry?.querySelectorAll('category') ?? [], (category) =>
          category.getAttribute('term'),
        ),
      ).toEqual(post.topicKeys.map((key) => translate('fr', key)));
    }
    const operation = OpenApi.fromApi(Api).paths['/api/blog/feed']?.get;
    expect(operation?.responses['200']?.content).toHaveProperty('application/atom+xml');
    expect(operation?.security ?? []).toEqual([]);
  } finally {
    await server.dispose();
  }
});
