import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  Renderer2,
} from '@angular/core';
import {
  RouterLink,
  RouterLinkActive,
  type IsActiveMatchOptions,
  type Params,
  type QueryParamsHandling,
} from '@angular/router';

export interface TabItem {
  readonly path: string;
  readonly id: string;
  readonly label: string;
  readonly exact?: boolean;
  readonly queryParams?: Params;
  readonly active?: boolean;
}

@Component({
  selector: 'app-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  readonly label = input.required<string>();
  readonly tabs = input.required<readonly TabItem[]>();
  readonly disabled = input(false);
  readonly preserveQuery = input(false);
  readonly preserveFragment = input(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    const renderer = inject(Renderer2);
    const destroyRef = inject(DestroyRef);

    for (const eventName of ['click', 'auxclick']) {
      const unlisten = renderer.listen(
        host.nativeElement,
        eventName,
        (event: MouseEvent) => {
          if (this.disabled()) {
            event.preventDefault();
            event.stopPropagation();
          }
        },
        { capture: true },
      );
      destroyRef.onDestroy(unlisten);
    }
  }

  protected activeOptions(tab: TabItem): IsActiveMatchOptions {
    return {
      paths: tab.exact === false ? 'subset' : 'exact',
      queryParams: tab.active === undefined && tab.queryParams ? 'subset' : 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    };
  }

  protected queryParamsHandling(tab: TabItem): QueryParamsHandling {
    if (!this.preserveQuery()) return '';
    return tab.queryParams ? 'merge' : 'preserve';
  }

  protected isActive(tab: TabItem, routeActive: boolean): boolean {
    return tab.active ?? routeActive;
  }

  protected currentPage(tab: TabItem): 'page' | undefined {
    return tab.active === false ? undefined : 'page';
  }
}
