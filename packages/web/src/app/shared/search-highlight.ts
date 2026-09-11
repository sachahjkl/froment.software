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

@Injectable({ providedIn: 'root' })
class SearchHighlightStore implements OnDestroy {
  private readonly registry = inject(DOCUMENT).defaultView?.CSS?.highlights;
  private readonly highlight = this.registry ? new Highlight() : undefined;
  private readonly ranges = new Map<Range, number>();

  add(ranges: readonly Range[]): () => void {
    const highlight = this.highlight;
    const registry = this.registry;
    if (!highlight || !registry || ranges.length === 0) return () => undefined;
    for (const range of ranges) {
      this.ranges.set(range, (this.ranges.get(range) ?? 0) + 1);
      highlight.add(range);
    }
    registry.set(highlightName, highlight);
    return () => {
      for (const range of ranges) {
        const count = this.ranges.get(range) ?? 0;
        if (count > 1) {
          this.ranges.set(range, count - 1);
        } else {
          this.ranges.delete(range);
          highlight.delete(range);
        }
      }
      if (highlight.size === 0 && registry.get(highlightName) === highlight) {
        registry.delete(highlightName);
      }
    };
  }

  ngOnDestroy(): void {
    this.ranges.clear();
    this.highlight?.clear();
    const registry = this.registry;
    if (registry && registry.get(highlightName) === this.highlight) {
      registry.delete(highlightName);
    }
  }
}

@Injectable()
export class SearchHighlightRegistry implements OnDestroy {
  private readonly store = inject(SearchHighlightStore);
  private readonly cleanups = new Set<() => void>();

  add(ranges: readonly Range[]): () => void {
    const release = this.store.add(ranges);
    const cleanup = () => {
      if (this.cleanups.delete(cleanup)) release();
    };
    this.cleanups.add(cleanup);
    return cleanup;
  }

  ngOnDestroy(): void {
    for (const cleanup of this.cleanups) cleanup();
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
