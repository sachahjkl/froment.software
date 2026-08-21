import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  effect,
  inject,
  input,
  Injectable,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Directive({ selector: 'ng-template[appTabPanel]' })
export class TabPanel {
  readonly name = input.required<string>({ alias: 'appTabPanel' });
  readonly template = inject(TemplateRef<unknown>);
}

@Injectable()
class TabPanelRegistry {
  readonly panels = signal<ReadonlyMap<string, TemplateRef<unknown>>>(new Map());
}

@Directive({
  selector: '[appTabLayout]',
  providers: [TabPanelRegistry],
})
export class TabLayout {
  private readonly registry = inject(TabPanelRegistry);
  private readonly panels = contentChildren(TabPanel, { descendants: true });

  constructor() {
    effect(() => {
      this.registry.panels.set(
        new Map(this.panels().map((panel) => [panel.name(), panel.template] as const)),
      );
    });
  }
}

@Component({
  selector: 'app-tab-panel-outlet',
  imports: [NgTemplateOutlet],
  template: `<ng-container *ngTemplateOutlet="panel(); context: context" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabPanelOutlet {
  private readonly route = inject(ActivatedRoute);
  private readonly registry = inject(TabPanelRegistry);
  protected readonly context = this.route.snapshot.data;
  protected readonly panel = computed(() => {
    const name: string = this.route.snapshot.data['panel'];
    return this.registry.panels().get(name) ?? null;
  });
}
