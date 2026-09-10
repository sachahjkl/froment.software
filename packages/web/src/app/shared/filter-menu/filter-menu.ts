import { _IdGenerator } from '@angular/cdk/a11y';
import { Dialog, type DialogRef } from '@angular/cdk/dialog';
import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu';
import { Overlay } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  Renderer2,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { Button } from '@shared/button/button';
import { Icon } from '@shared/icon/icon';
import { FilterPanel } from './filter-panel';

export { FilterPanel } from './filter-panel';

@Component({
  imports: [Button, CdkMenu, CdkMenuItem, Icon, NgTemplateOutlet],
  selector: 'app-filter-menu',
  styleUrl: './filter-menu.scss',
  templateUrl: './filter-menu.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterMenu {
  readonly label = input.required<string>();
  readonly closeLabel = input.required<string>();
  readonly backLabel = input.required<string>();
  readonly activeCount = input(0);
  readonly disabled = input(false);
  protected readonly opened = signal(false);
  protected readonly panels = contentChildren(FilterPanel);
  protected readonly activePanel = signal<FilterPanel | undefined>(undefined);
  protected readonly triggerLabel = computed(() =>
    this.activeCount() > 0 ? `${this.label()} (${this.activeCount()})` : this.label(),
  );
  protected readonly dialogId = inject(_IdGenerator).getId('list-filters-');
  protected readonly headingId = `${this.dialogId}-heading`;
  private readonly dialogs = inject(Dialog);
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly renderer = inject(Renderer2);
  private readonly content = viewChild.required<TemplateRef<unknown>>('content');
  private readonly trigger = viewChild.required('trigger', { read: ElementRef<HTMLButtonElement> });
  private readonly categories = viewChild(CdkMenu);
  private readonly panelContent = viewChild<ElementRef<HTMLElement>>('panelContent');
  private readonly backButton = viewChild('backButton', { read: ElementRef<HTMLButtonElement> });
  private dialog: DialogRef | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.dialog?.close());
  }

  protected open(): void {
    if (this.disabled() || this.dialog || this.panels().length === 0) return;
    this.activePanel.set(undefined);
    const position = this.overlay
      .position()
      .flexibleConnectedTo(this.trigger())
      .withPositions([
        { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
        { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
        { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
      ])
      .withViewportMargin(8)
      .withPush(true);
    const dialog = this.dialogs.open(this.content(), {
      id: this.dialogId,
      ariaLabelledBy: this.headingId,
      ariaModal: true,
      autoFocus: 'dialog',
      restoreFocus: this.trigger().nativeElement,
      disableAnimations: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      positionStrategy: position,
      width: '20rem',
      maxWidth: 'calc(100vw - 1rem)',
    });
    this.dialog = dialog;
    this.opened.set(true);
    afterNextRender(
      () => {
        if (this.dialog !== dialog || this.activePanel()) return;
        // Initialisez aussi l’élément actif CDK, pas seulement le focus DOM.
        this.categories()?.focusFirstItem();
      },
      { injector: this.injector },
    );
    // Le combobox toujours ouvert consomme Échap. Fermez son dialogue avant cette consommation.
    const stopListening = this.renderer.listen(
      dialog.overlayRef.overlayElement,
      'keydown',
      (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        dialog.close();
      },
      { capture: true },
    );
    dialog.closed.subscribe(() => {
      stopListening();
      this.dialog = undefined;
      this.opened.set(false);
      this.activePanel.set(undefined);
    });
  }

  protected showPanel(panel: FilterPanel): void {
    const dialog = this.dialog;
    if (!dialog) return;
    this.activePanel.set(panel);
    afterNextRender(
      () => {
        if (this.dialog !== dialog) return;
        dialog.overlayRef.updatePosition();
        const control = this.panelContent()?.nativeElement.querySelector<HTMLElement>(
          ':is(input:not([type="hidden"]), select, textarea, button, [cdkFocusInitial]):not(:disabled)',
        );
        (control ?? this.backButton()?.nativeElement)?.focus();
      },
      { injector: this.injector },
    );
  }

  back(): void {
    const dialog = this.dialog;
    const panel = this.activePanel();
    if (!dialog || !panel) return;
    const index = this.panels().indexOf(panel);
    this.activePanel.set(undefined);
    afterNextRender(
      () => {
        if (this.dialog !== dialog) return;
        dialog.overlayRef.updatePosition();
        this.categories()?.setActiveMenuItem(Math.max(0, index));
      },
      { injector: this.injector },
    );
  }

  close(): void {
    this.dialog?.close();
  }
}
