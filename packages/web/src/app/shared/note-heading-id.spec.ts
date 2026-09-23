import { noteHeadingId } from './note-heading-id';

describe('noteHeadingId', () => {
  it('creates stable ASCII identifiers and numbers duplicates', () => {
    const occurrences = new Map<string, number>();

    expect(noteHeadingId("Une chaîne d'intégrité", occurrences)).toBe('une-chaine-d-integrite');
    expect(noteHeadingId("Une chaîne d'intégrité", occurrences)).toBe('une-chaine-d-integrite-2');
  });
});
