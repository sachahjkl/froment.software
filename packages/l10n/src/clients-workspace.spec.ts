import { describe, expect, it } from 'vitest';
import { clientsWorkspaceText } from './clients-workspace.js';

describe('client workspace translations', () => {
  it('uses matching keys and parameters in French and English', () => {
    expect(Object.keys(clientsWorkspaceText.fr).sort()).toEqual(
      Object.keys(clientsWorkspaceText.en).sort(),
    );
    for (const key of Object.keys(
      clientsWorkspaceText.fr,
    ) as (keyof typeof clientsWorkspaceText.fr)[]) {
      expect(clientsWorkspaceText.fr[key].match(/\{\w+\}/g) ?? []).toEqual(
        clientsWorkspaceText.en[key].match(/\{\w+\}/g) ?? [],
      );
    }
  });

  it('provides one and other client counts without the old plain key', () => {
    for (const language of ['fr', 'en'] as const) {
      const text = clientsWorkspaceText[language];
      expect(Object.keys(text)).not.toContain('clientsWorkspace.count');
      expect(text['clientsWorkspace.count.one']).toBe('{count} client');
      expect(text['clientsWorkspace.count.other']).toBe('{count} clients');
    }
  });
});
