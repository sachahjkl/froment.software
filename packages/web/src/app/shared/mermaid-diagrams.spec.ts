import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import mermaid, { type RenderResult } from 'mermaid';
import { MermaidDiagrams } from './mermaid-diagrams';

@Component({
  imports: [MermaidDiagrams],
  template: '<div [innerHTML]="content()" [appMermaidDiagrams]="content()"></div>',
})
class DiagramContent {
  readonly content = signal('<h2>Premier titre</h2><pre class="mermaid">flowchart LR; A-->B</pre>');
}

describe('MermaidDiagrams', () => {
  beforeEach(() => {
    vi.spyOn(mermaid, 'initialize').mockImplementation(() => undefined);
    vi.spyOn(mermaid, 'render').mockResolvedValue({
      svg: '<svg aria-label="current"></svg>',
      diagramType: 'flowchart',
    });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('updates heading targets when the HTML changes without diagrams', async () => {
    const fixture = TestBed.createComponent(DiagramContent);
    fixture.componentInstance.content.set('<h2>Premier titre</h2>');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('h2')?.id).toBe('premier-titre');

    fixture.componentInstance.content.set('<h2>Second title</h2><h2>Second title</h2>');
    await fixture.whenStable();
    expect(Array.from(root.querySelectorAll('h2'), (heading) => heading.id)).toEqual([
      'second-title',
      'second-title-2',
    ]);
    expect(mermaid.render).not.toHaveBeenCalled();
  });

  it('does not publish or bind an obsolete SVG after the content changes', async () => {
    let complete!: (result: RenderResult) => void;
    const pending = new Promise<RenderResult>((resolve) => {
      complete = resolve;
    });
    vi.mocked(mermaid.render).mockReturnValueOnce(pending);
    const fixture = TestBed.createComponent(DiagramContent);
    await fixture.whenStable();
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce());
    const original = fixture.nativeElement.querySelector('pre') as HTMLElement;

    fixture.componentInstance.content.set(
      '<h2>Second title</h2><pre class="mermaid">flowchart LR; C-->D</pre>',
    );
    await fixture.whenStable();
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2));
    const bindFunctions = vi.fn();
    complete({ svg: '<svg aria-label="obsolete"></svg>', diagramType: 'flowchart', bindFunctions });
    await pending;
    await fixture.whenStable();

    expect(bindFunctions).not.toHaveBeenCalled();
    expect(original.querySelector('svg')).toBeNull();
    expect(fixture.nativeElement.querySelector('h2')?.id).toBe('second-title');
    expect(fixture.nativeElement.querySelector('svg')?.getAttribute('aria-label')).toBe('current');
  });

  it('does not bind an SVG after its host is destroyed', async () => {
    let complete!: (result: RenderResult) => void;
    const pending = new Promise<RenderResult>((resolve) => {
      complete = resolve;
    });
    vi.mocked(mermaid.render).mockReturnValueOnce(pending);
    const fixture = TestBed.createComponent(DiagramContent);
    await fixture.whenStable();
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledOnce());
    fixture.destroy();
    const bindFunctions = vi.fn();
    complete({ svg: '<svg></svg>', diagramType: 'flowchart', bindFunctions });
    await pending;
    expect(bindFunctions).not.toHaveBeenCalled();
  });
});
