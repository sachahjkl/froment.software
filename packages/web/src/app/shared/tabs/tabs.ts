import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

export interface TabItem {
  readonly value: string;
  readonly id: string;
  readonly label: string;
  readonly panelId: string;
  readonly queryValue?: string;
}

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly queryValue = signal<string | null>(null);
  private initialized = false;
  private previousQueryValue: string | null = null;
  private previousSelected = '';
  readonly label = input.required<string>();
  readonly tabs = input.required<readonly TabItem[]>();
  readonly selected = input.required<string>();
  readonly queryParam = input('tab');
  readonly disabled = input(false);
  readonly selectedChange = output<string>();

  constructor() {
    afterNextRender(() => {
      const queryParamMap = this.route?.queryParamMap;
      if (queryParamMap === undefined || this.router === null) return;
      queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((parameters) => {
        this.queryValue.set(parameters.get(this.queryParam()));
      });
      effect(() => this.synchronize(), { injector: this.injector });
    });
  }

  protected select(tab: TabItem, target?: HTMLElement): void {
    if (this.disabled()) return;
    this.selectedChange.emit(tab.value);
    target?.focus();
  }

  protected move(event: Event, index: number, offset: number): void {
    event.preventDefault();
    const tabs = this.tabs();
    const tab = tabs[(index + offset + tabs.length) % tabs.length];
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const buttons = target.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
    if (tab !== undefined)
      this.select(tab, buttons?.item((index + offset + tabs.length) % tabs.length));
  }

  private synchronize(): void {
    const selected = this.selected();
    const queryValue = this.queryValue();
    const tabs = this.tabs();
    if (!this.initialized) {
      this.initialized = true;
      this.previousSelected = selected;
      this.previousQueryValue = queryValue;
      const queryTab = tabs.find((tab) => (tab.queryValue ?? tab.value) === queryValue);
      if (queryTab !== undefined && queryTab.value !== selected) {
        this.previousSelected = queryTab.value;
        this.selectedChange.emit(queryTab.value);
        return;
      }
      return;
    }

    if (queryValue !== this.previousQueryValue) {
      this.previousQueryValue = queryValue;
      const queryTab = tabs.find((tab) => (tab.queryValue ?? tab.value) === queryValue);
      if (queryTab !== undefined && queryTab.value !== selected) {
        this.previousSelected = queryTab.value;
        this.selectedChange.emit(queryTab.value);
      } else if (queryTab === undefined) {
        this.writeQueryValue(selected, tabs, queryValue);
      }
      return;
    }

    if (selected !== this.previousSelected) {
      this.previousSelected = selected;
      this.writeQueryValue(selected, tabs, queryValue);
    }
  }

  private writeQueryValue(
    selected: string,
    tabs: readonly TabItem[],
    currentQueryValue: string | null,
  ): void {
    if (this.route === null || this.router === null) return;
    const tab = tabs.find((candidate) => candidate.value === selected);
    if (tab === undefined) return;
    const queryValue = tab.queryValue ?? tab.value;
    if (queryValue === currentQueryValue) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [this.queryParam()]: queryValue },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
