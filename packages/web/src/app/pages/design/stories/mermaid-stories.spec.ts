import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { I18nService } from '@app/i18n.service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mermaid from 'mermaid';
import { componentReferenceText } from '@froment/l10n/component-reference';
import { designRoutes } from '../design.routes';

describe('Mermaid reference', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'design', children: designRoutes }])],
    });
    // Les imports concurrents contournent le mock de module manuel dans Vitest.
    // Les espions remplacent les méthodes du même objet Mermaid déjà chargé.
    vi.spyOn(mermaid, 'initialize').mockImplementation(() => undefined);
    vi.spyOn(mermaid, 'run').mockResolvedValue(undefined);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function setup() {
    TestBed.inject(I18nService).setLanguage('en');
    const harness = await RouterTestingHarness.create('/design/mermaid-diagrams');
    await harness.fixture.whenStable();
    return { harness, root: harness.routeNativeElement! };
  }

  it('uses the real directive with strict rendering and explicit local nodes', async () => {
    const { harness, root } = await setup();
    const expectRenderedSources = async (sources: readonly string[]) => {
      await vi.waitFor(async () => {
        await harness.fixture.whenStable();
        harness.fixture.detectChanges();
        const currentNodes = Array.from(root.querySelectorAll<HTMLElement>('pre.mermaid'));
        expect(currentNodes).toHaveLength(3);
        expect(currentNodes.map((node) => node.textContent)).toEqual(sources);
        const renderedNodes = vi.mocked(mermaid.run).mock.calls.flatMap(([options]) => {
          expect(options).toEqual(
            expect.objectContaining({ nodes: expect.any(Array), suppressErrors: true }),
          );
          return Array.from(options!.nodes!);
        });
        expect(new Set(renderedNodes.filter((node) => node.isConnected))).toEqual(
          new Set(currentNodes),
        );
      });
    };
    const english = componentReferenceText.en.diagrams;
    await expectRenderedSources([english.flowchart, english.flowchart, english.sequence]);
    expect(mermaid.initialize).toHaveBeenCalledWith({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
    });
    const original = root.querySelector('[storyPreview] .mermaid');
    const select = root.querySelector<HTMLSelectElement>('[storyControls] select')!;
    select.value = 'sequence';
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await harness.fixture.whenStable();
    await expectRenderedSources([english.sequence, english.flowchart, english.sequence]);
    expect(original?.isConnected).toBe(false);
    expect(root.querySelector('[storyPreview] .mermaid')?.textContent).toContain('sequenceDiagram');
    expect(root.querySelector('[storyPreview] .mermaid')?.textContent).toContain('accTitle:');
    expect(root.querySelector('[storyControls] textarea, [storyControls] input')).toBeNull();
    TestBed.inject(I18nService).setLanguage('fr');
    await harness.fixture.whenStable();
    const french = componentReferenceText.fr.diagrams;
    await expectRenderedSources([french.sequence, french.flowchart, french.sequence]);
    expect(root.querySelector('[storyPreview] .mermaid')?.textContent).toContain('Données locales');
  });

  it('keeps source text in Angular server mode without initializing Mermaid', async () => {
    // Angular 22 vérifie ngServerMode avant de planifier afterRenderEffect.
    vi.stubGlobal('ngServerMode', true);
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const { root } = await setup();
    expect(root.querySelectorAll('pre.mermaid')).toHaveLength(3);
    expect(root.querySelector('[storyPreview] pre')?.textContent).toContain('flowchart LR');
    expect(root.querySelector('svg, script, iframe')).toBeNull();
    expect(mermaid.initialize).not.toHaveBeenCalled();
    expect(mermaid.run).not.toHaveBeenCalled();
  });

  it('retains the directive error marker if rendering fails', async () => {
    vi.mocked(mermaid.run).mockRejectedValueOnce(new Error('reference.render_failed'));
    const { root } = await setup();
    await vi.waitFor(() => expect(root.querySelectorAll('.mermaid-error')).toHaveLength(1));
    expect(root.querySelector('[storyPreview] pre')?.textContent).toContain('flowchart LR');
  });
});
