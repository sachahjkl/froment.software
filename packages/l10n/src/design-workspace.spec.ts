import { describe, expect, it } from 'vitest';
import { designWorkspaceText } from './design-workspace';

describe('design workspace text', () => {
  it('provides matching French and English labels and states', () => {
    expect(Object.keys(designWorkspaceText.fr).sort()).toEqual(
      Object.keys(designWorkspaceText.en).sort(),
    );
    expect(Object.keys(designWorkspaceText.fr.scenarios).sort()).toEqual(
      Object.keys(designWorkspaceText.en.scenarios).sort(),
    );
  });

  it('states the limits of the local preview and result count', () => {
    expect(designWorkspaceText.fr.preview).toContain('non enregistré');
    expect(designWorkspaceText.en.preview).toContain('not saved');
    expect(designWorkspaceText.fr.localScope).toContain('fictives');
    expect(designWorkspaceText.en.localScope).toContain('fictional');
    expect(designWorkspaceText.fr.exportScope).toContain('toutes les pages');
    expect(designWorkspaceText.en.exportScope).toContain('across all pages');
  });
});
