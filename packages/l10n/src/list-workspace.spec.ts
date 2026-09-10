import { describe, expect, it } from 'vitest';
import { listWorkspaceText } from './list-workspace.js';

describe('listWorkspaceText', () => {
  it('provides matching French and English labels', () => {
    expect(Object.keys(listWorkspaceText.fr).sort()).toEqual(
      Object.keys(listWorkspaceText.en).sort(),
    );
    expect(Object.values(listWorkspaceText.fr).every((text) => text.length > 0)).toBe(true);
    expect(Object.values(listWorkspaceText.en).every((text) => text.length > 0)).toBe(true);
  });

  it('states the displayed-result scope and the CSV format', () => {
    expect(listWorkspaceText.fr['listWorkspace.exportCsv']).toBe(
      'Exporter les résultats affichés (CSV)',
    );
    expect(listWorkspaceText.en['listWorkspace.exportCsv']).toBe('Export displayed results (CSV)');
  });
});
