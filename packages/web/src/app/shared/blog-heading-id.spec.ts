import { blogHeadingId } from './blog-heading-id';

describe('blogHeadingId', () => {
  it('creates stable ASCII identifiers and numbers duplicates', () => {
    const occurrences = new Map<string, number>();

    expect(blogHeadingId("Une chaîne d'intégrité", occurrences)).toBe('une-chaine-d-integrite');
    expect(blogHeadingId("Une chaîne d'intégrité", occurrences)).toBe('une-chaine-d-integrite-2');
  });
});
