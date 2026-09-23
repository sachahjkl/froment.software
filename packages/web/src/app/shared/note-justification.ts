import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';
import { lineText, prepare, solve } from '@kitlangton/justice';

@Directive({ selector: '[appNoteJustification]' })
export class NoteJustification {
  readonly content = input.required<string>({ alias: 'appNoteJustification' });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterRenderEffect((onCleanup) => {
      this.content();
      const paragraphs = Array.from(this.element.nativeElement.querySelectorAll('p')).filter(
        (paragraph) =>
          paragraph.childNodes.length === 1 &&
          paragraph.firstChild?.nodeType === Node.TEXT_NODE &&
          paragraph.textContent !== null &&
          paragraph.textContent.trim().length > 80,
      );
      if (paragraphs.length === 0) return;

      let active = true;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;

      let lastWidth = 0;
      const update = (force = false) => {
        if (!active) return;
        const containerWidth = this.element.nativeElement.clientWidth;
        if (!force && containerWidth === lastWidth) return;
        lastWidth = containerWidth;
        for (const paragraph of paragraphs) {
          const original = paragraph.dataset['originalText'] ?? paragraph.textContent ?? '';
          paragraph.dataset['originalText'] = original;
          const width = paragraph.clientWidth;
          if (width < 320) {
            paragraph.textContent = original;
            continue;
          }
          const style = getComputedStyle(paragraph);
          context.font = style.font;
          const prepared = prepare(original, (text) => context.measureText(text).width);
          const lines = solve(prepared, width).lines;
          if (lines.length === 0) continue;
          paragraph.replaceChildren(
            ...lines.map((line, index) => {
              const span = document.createElement('span');
              span.className = 'justified-line';
              span.textContent = lineText(prepared, line);
              span.style.wordSpacing = `${line.wordSpacing}px`;
              span.style.letterSpacing = `${line.tracking}px`;
              span.style.marginInlineStart = `${-line.opening}px`;
              if (index < lines.length - 1) span.append(' ');
              return span;
            }),
          );
        }
      };
      const observer = new ResizeObserver(() => update());
      observer.observe(this.element.nativeElement);
      void document.fonts.ready.then(() => update(true));
      onCleanup(() => {
        active = false;
        observer.disconnect();
      });
    });
  }
}
