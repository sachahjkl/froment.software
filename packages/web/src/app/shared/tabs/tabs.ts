import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface TabItem {
  readonly path: string;
  readonly id: string;
  readonly label: string;
  readonly exact?: boolean;
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
}
