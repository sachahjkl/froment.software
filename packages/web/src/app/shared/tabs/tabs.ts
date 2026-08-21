import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface TabItem {
  readonly value: string;
  readonly id: string;
  readonly label: string;
  readonly panelId: string;
}

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tabs {
  readonly label = input.required<string>();
  readonly tabs = input.required<readonly TabItem[]>();
  readonly selected = input.required<string>();
  readonly disabled = input(false);
  readonly selectedChange = output<string>();

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
}
