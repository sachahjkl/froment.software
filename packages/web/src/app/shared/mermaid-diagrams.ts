import { _IdGenerator } from '@angular/cdk/a11y';
import { afterRenderEffect, Directive, ElementRef, inject, input } from '@angular/core';
import { I18nService, type TranslationKey } from '@app/i18n.service';
import { noteHeadingId } from './note-heading-id';

@Directive({
  selector: '[appMermaidDiagrams]',
})
export class MermaidDiagrams {
  readonly content = input.required<string>({ alias: 'appMermaidDiagrams' });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);
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
        heading.id = noteHeadingId(heading.textContent ?? '', headingOccurrences);
      }

      const diagrams = Array.from(
        this.element.nativeElement.querySelectorAll<HTMLElement>('pre.mermaid'),
      ).map((node) => ({ node, source: node.textContent ?? '' }));
      if (diagrams.length === 0) return;

      let active = true;
      const dispose: Array<() => void> = [];
      onCleanup(() => {
        active = false;
        for (const destroy of dispose) destroy();
      });
      void Promise.all([import('mermaid'), import('@panzoom/panzoom')])
        .then(async ([{ default: mermaid }, { default: Panzoom }]) => {
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
              const svg = node.querySelector('svg');
              if (!svg) continue;
              const viewer = document.createElement('div');
              viewer.className = 'mermaid-viewer';
              node.before(viewer);
              viewer.append(node);
              const panzoom = Panzoom(svg, { maxScale: 6, minScale: 0.25 });
              node.tabIndex = 0;
              node.setAttribute('aria-label', this.i18n.t('notes.diagram.move'));
              const controls = document.createElement('div');
              controls.className = 'mermaid-controls';
              const addButton = (text: string, label: TranslationKey, action: () => void) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = text;
                button.setAttribute('aria-label', this.i18n.t(label));
                button.addEventListener('click', action);
                controls.append(button);
              };
              addButton('+', 'notes.diagram.zoomIn', () => panzoom.zoomIn());
              addButton('−', 'notes.diagram.zoomOut', () => panzoom.zoomOut());
              addButton('↺', 'notes.diagram.reset', () => panzoom.reset());
              const fullscreenButton = document.createElement('button');
              fullscreenButton.type = 'button';
              fullscreenButton.textContent = '⛶';
              const updateFullscreenLabel = () =>
                fullscreenButton.setAttribute(
                  'aria-label',
                  this.i18n.t(
                    document.fullscreenElement === viewer
                      ? 'notes.diagram.exitFullscreen'
                      : 'notes.diagram.fullscreen',
                  ),
                );
              updateFullscreenLabel();
              fullscreenButton.addEventListener('click', () => {
                if (document.fullscreenElement === viewer) void document.exitFullscreen();
                else void viewer.requestFullscreen();
              });
              document.addEventListener('fullscreenchange', updateFullscreenLabel);
              controls.append(fullscreenButton);
              viewer.append(controls);
              const onWheel = (event: WheelEvent) => {
                if (event.ctrlKey || event.metaKey) panzoom.zoomWithWheel(event);
              };
              const onKeydown = (event: KeyboardEvent) => {
                let x = 0;
                let y = 0;
                if (event.key === 'ArrowLeft') x = -40;
                else if (event.key === 'ArrowRight') x = 40;
                else if (event.key === 'ArrowUp') y = -40;
                else if (event.key === 'ArrowDown') y = 40;
                else return;
                event.preventDefault();
                panzoom.pan(x, y, { relative: true });
              };
              node.addEventListener('wheel', onWheel, { passive: false });
              node.addEventListener('keydown', onKeydown);
              dispose.push(() => {
                node.removeEventListener('wheel', onWheel);
                node.removeEventListener('keydown', onKeydown);
                document.removeEventListener('fullscreenchange', updateFullscreenLabel);
                panzoom.destroy();
              });
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
