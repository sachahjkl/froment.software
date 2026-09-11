import { Component, createEnvironmentInjector, EnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FuseResultMatch } from 'fuse.js';
import { SearchHighlight, SearchHighlightRegistry } from './search-highlight';

class TestHighlight extends Set<Range> {}

@Component({
  imports: [SearchHighlight],
  providers: [SearchHighlightRegistry],
  template: `<span [appSearchHighlight]="indices()">{{ text() }}</span>`,
})
class TestResults {
  readonly text = signal('Atlas');
  readonly indices = signal<FuseResultMatch['indices']>([[0, 2]]);
}

describe('SearchHighlightRegistry', () => {
  let highlights: Map<string, TestHighlight>;

  beforeEach(() => {
    highlights = new Map();
    vi.stubGlobal('CSS', { ...globalThis.CSS, highlights });
    vi.stubGlobal('Highlight', TestHighlight);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('keeps list and dialog ranges together and removes only the destroyed component ranges', async () => {
    const list = TestBed.createComponent(TestResults);
    const dialog = TestBed.createComponent(TestResults);
    dialog.componentInstance.text.set('Dialogue');
    await list.whenStable();
    await dialog.whenStable();

    const highlight = highlights.get('search-match')!;
    expect([...highlight].map((range) => range.toString())).toEqual(['Atl', 'Dia']);

    dialog.destroy();

    expect(highlights.get('search-match')).toBe(highlight);
    expect([...highlight].map((range) => range.toString())).toEqual(['Atl']);

    list.destroy();

    expect(highlights.has('search-match')).toBe(false);
  });

  it('replaces directive ranges without clearing the other component', async () => {
    const list = TestBed.createComponent(TestResults);
    const dialog = TestBed.createComponent(TestResults);
    dialog.componentInstance.text.set('Dialogue');
    await list.whenStable();
    await dialog.whenStable();

    list.componentInstance.indices.set([[3, 4]]);
    await list.whenStable();

    expect([...highlights.get('search-match')!].map((range) => range.toString()).sort()).toEqual([
      'Dia',
      'as',
    ]);

    list.componentInstance.indices.set([]);
    await list.whenStable();

    expect([...highlights.get('search-match')!].map((range) => range.toString())).toEqual(['Dia']);
    dialog.destroy();
    expect(highlights.has('search-match')).toBe(false);
    list.destroy();
  });

  it('releases scoped registrations once and keeps a range until its last owner releases it', () => {
    const parent = TestBed.inject(EnvironmentInjector);
    const list = createEnvironmentInjector([SearchHighlightRegistry], parent);
    const dialog = createEnvironmentInjector([SearchHighlightRegistry], parent);
    const range = new Range();
    const releaseList = list.get(SearchHighlightRegistry).add([range]);
    const releaseDialog = dialog.get(SearchHighlightRegistry).add([range]);

    releaseList();
    releaseList();
    list.destroy();
    expect([...highlights.get('search-match')!]).toEqual([range]);

    dialog.destroy();
    releaseDialog();
    expect(highlights.has('search-match')).toBe(false);
  });

  it('leaves text unchanged when the CSS Highlight API is unavailable', async () => {
    vi.stubGlobal('CSS', {});
    const fixture = TestBed.createComponent(TestResults);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toBe('Atlas');
    expect(highlights.size).toBe(0);
    fixture.destroy();
  });
});
