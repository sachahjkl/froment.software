/// <reference lib="dom" />
// @vitest-environment jsdom

import { notes } from '@froment/l10n/notes';
import { expect, it } from 'vitest';
import { notesFeed } from './feed.js';

it('publishes valid Atom entries for every note', () => {
  const origin = 'https://example.test';
  const document = new DOMParser().parseFromString(notesFeed(origin), 'application/xml');
  expect(document.querySelector('parsererror')).toBeNull();
  expect(document.documentElement.namespaceURI).toBe('http://www.w3.org/2005/Atom');
  expect(document.querySelector('feed > id')?.textContent).toBe(`${origin}/notes/feed`);
  expect(document.querySelector('feed > link[rel="self"]')?.getAttribute('href')).toBe(
    `${origin}/notes/feed`,
  );
  expect(
    document.querySelector('feed > link[rel="alternate"][hreflang="fr"]')?.getAttribute('href'),
  ).toBe(`${origin}/fr/notes`);
  expect(
    document.querySelector('feed > link[rel="alternate"][hreflang="en"]')?.getAttribute('href'),
  ).toBe(`${origin}/en/notes`);
  expect(
    Array.from(document.querySelectorAll('feed > entry > id'), (id) => id.textContent),
  ).toEqual(notes.map((note) => `${origin}/fr/notes/${note.slug}`));
  expect(
    Array.from(
      document.querySelectorAll('feed > entry > link[rel="alternate"][hreflang="en"]'),
      (link) => link.getAttribute('href'),
    ),
  ).toEqual(notes.map((note) => `${origin}/en/notes/${note.slug}`));
});
