import { describe, expect, it } from 'vitest';
import { requestLanguage } from './language.js';

describe('request language', () => {
  it.each([
    [undefined, 'fr'],
    ['en-GB,en;q=0.9,fr;q=0.5', 'en'],
    ['en;q=0.2,fr-CA;q=0.9', 'fr'],
    ['fr;q=0,en;q=0.5', 'en'],
    ['de-DE', 'fr'],
    ['*', 'fr'],
    ['EN-us', 'en'],
  ])('selects a supported language for %s', (header, expected) => {
    expect(requestLanguage(header)).toBe(expected);
  });
});
