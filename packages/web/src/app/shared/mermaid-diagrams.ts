import { _IdGenerator } from '@angular/cdk/a11y';
import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';
import { blogHeadingId } from './blog-heading-id';

@Directive({
  selector: '[appMermaidDiagrams]',
})
export class MermaidDiagrams {
  readonly content = input.required<string>({ alias: 'appMermaidDiagrams' });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly id = inject(_IdGenerator).getId('mermaid-diagrams-');
  private generation = 0;

  constructor() {
    afterRenderEffect((onCleanup) => {
      this.content();
      const generation = ++this.generation;
      const headingOccurrences = new Map<string, number>();
      for (const heading of this.element.nativeElement.querySelectorAll<HTMLElement>(
        'h2,h3,h4,h5,h6',
      )) {
        heading.id = blogHeadingId(heading.textContent ?? '', headingOccurrences);
      }

      const diagrams = Array.from(
        this.element.nativeElement.querySelectorAll<HTMLElement>('pre.mermaid'),
      ).map((node) => ({ node, source: node.textContent ?? '' }));
      if (diagrams.length === 0) return;

      let active = true;
      onCleanup(() => {
        active = false;
      });
      void import('mermaid')
        .then(async ({ default: mermaid }) => {
          if (!active) return;
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'neutral',
            suppressErrorRendering: true,
          });
          for (const [index, { node, source }] of diagrams.entries()) {
            if (!active) return;
            try {
              const result = await mermaid.render(`${this.id}-${generation}-${index}`, source);
              if (!active) return;
              // Mermaid assainit le SVG en mode strict avant sa publication.
              node.innerHTML = result.svg;
              result.bindFunctions?.(node);
              node.classList.remove('mermaid-error');
            } catch {
              if (active) node.classList.add('mermaid-error');
            }
          }
        })
        .catch(() => {
          if (active) for (const { node } of diagrams) node.classList.add('mermaid-error');
        });
    });
  }
}
