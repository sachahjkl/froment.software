import { afterRenderEffect, Directive, ElementRef, inject } from '@angular/core';
import { blogHeadingId } from './blog-heading-id';

@Directive({
  selector: '[appMermaidDiagrams]',
})
export class MermaidDiagrams {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect((onCleanup) => {
      const headingOccurrences = new Map<string, number>();
      for (const heading of this.element.nativeElement.querySelectorAll<HTMLElement>(
        'h2,h3,h4,h5,h6',
      )) {
        heading.id = blogHeadingId(heading.textContent ?? '', headingOccurrences);
      }

      const nodes = Array.from(
        this.element.nativeElement.querySelectorAll<HTMLElement>('pre.mermaid'),
      );
      if (nodes.length === 0) return;

      let active = true;
      onCleanup(() => {
        active = false;
      });
      void import('mermaid')
        .then(async ({ default: mermaid }) => {
          if (!active) return;
          mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
          await mermaid.run({ nodes, suppressErrors: true });
        })
        .catch(() => {
          for (const node of nodes) node.classList.add('mermaid-error');
        });
    });
  }
}
