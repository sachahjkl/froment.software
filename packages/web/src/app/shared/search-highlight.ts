import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  Directive,
  ElementRef,
  inject,
  Injectable,
  input,
  OnDestroy,
} from '@angular/core';
import type { FuseResultMatch } from 'fuse.js';

const highlightName = 'search-match';

@Injectable()
export class SearchHighlightRegistry implements OnDestroy {
  private readonly registry = inject(DOCUMENT).defaultView?.CSS?.highlights;
  private readonly highlight = this.registry ? new Highlight() : undefined;

  add(ranges: readonly Range[]): () => void {
    if (!this.highlight || !this.registry) return () => undefined;
    this.registry.set(highlightName, this.highlight);
    for (const range of ranges) this.highlight.add(range);
    return () => {
      for (const range of ranges) this.highlight?.delete(range);
    };
  }

  ngOnDestroy(): void {
    const registry = this.registry;
    if (registry && registry.get(highlightName) === this.highlight) {
      registry.delete(highlightName);
    }
  }
}

@Directive({
  selector: '[appSearchHighlight]',
})
export class SearchHighlight {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly registry = inject(SearchHighlightRegistry);
  readonly indices = input.required<FuseResultMatch['indices']>({
    alias: 'appSearchHighlight',
  });

  constructor() {
    afterRenderEffect((onCleanup) => {
      const text = this.element.nativeElement.firstChild;
      if (!(text instanceof Text)) return;
      const ranges = this.indices().map(([start, end]) => {
        const range = new Range();
        range.setStart(text, start);
        range.setEnd(text, end + 1);
        return range;
      });
      onCleanup(this.registry.add(ranges));
    });
  }
}
