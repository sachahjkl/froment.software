import { formatTranslation, translationParts } from '@froment/l10n';
import { clientDescriptionKeys } from './client-description';

describe('Client description translations', () => {
  it.each(['fr', 'en'] as const)(
    'keeps the client parameter in each full %s sentence',
    (language) => {
      for (const key of Object.values(clientDescriptionKeys)) {
        const parts = translationParts(language, key);
        expect(parts.filter((part) => part.kind === 'parameter')).toEqual([
          { kind: 'parameter', name: 'client' },
        ]);
        const client = '<Acme & partners>';
        const sentence = parts.map((part) => (part.kind === 'text' ? part.value : client)).join('');
        expect(sentence).toBe(formatTranslation(language, key, { client }));
        expect(sentence).toContain(client);
      }
    },
  );
});
