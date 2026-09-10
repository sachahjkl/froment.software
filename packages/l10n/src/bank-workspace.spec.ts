import { describe, expect, it } from 'vitest';
import { bankWorkspaceText } from './bank-workspace.js';

describe('Bank workspace translations', () => {
  it('provides the same keys and parameters in both languages', () => {
    expect(Object.keys(bankWorkspaceText.en).sort()).toEqual(
      Object.keys(bankWorkspaceText.fr).sort(),
    );
    for (const key of Object.keys(bankWorkspaceText.fr) as (keyof typeof bankWorkspaceText.fr)[]) {
      const parameters = (value: string) =>
        [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
      expect(parameters(bankWorkspaceText.fr[key])).toEqual(parameters(bankWorkspaceText.en[key]));
    }
  });
});
