import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField } from '@angular/forms/signals';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Button } from '@shared/button/button';
import { Drawer } from '@shared/drawer/drawer';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { ListSearch } from '@shared/list-search/list-search';
import { SiteFooter } from '@shared/site-footer/site-footer';
import { referenceCatalog, referenceGroups } from './reference-catalog';
import { formatReferenceCount, referenceText } from './reference-text';

@Component({
  selector: 'app-design',
  imports: [
    NgTemplateOutlet,
    Button,
    Drawer,
    FormField,
    ListSearch,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    SiteFooter,
  ],
  templateUrl: './design.component.html',
  styleUrl: './design.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignComponent {
  protected readonly text = referenceText();
  protected readonly query = signal('');
  protected readonly search = form(this.query);
  protected readonly drawerOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly failedUrl = signal('');
  private readonly router = inject(Router);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly matches = createFuzzySearch(signal(referenceCatalog), this.query, {
    keys: ['name', 'id', 'selectors'],
    ignoreLocation: true,
    ignoreDiacritics: true,
    threshold: 0.3,
  });
  protected readonly groups = computed(() =>
    referenceGroups
      .map((id) => ({
        id,
        entries: this.matches()
          .filter(({ item }) => item.group === id)
          .map(({ item }) => item),
      }))
      .filter((group) => group.entries.length),
  );
  protected readonly count = computed(() => this.matches().length);
  protected readonly countLabel = computed(() =>
    formatReferenceCount(this.count(), this.text().language, this.text().componentCount),
  );

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.loading.set(true);
        this.failedUrl.set('');
      }
      if (event instanceof NavigationError) this.failedUrl.set(event.url);
      if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      )
        this.loading.set(false);
      if (event instanceof NavigationEnd) {
        this.drawerOpen.set(false);
        this.focusPage();
      }
    });
  }
  protected focusPage(): void {
    afterNextRender(
      () =>
        this.element.nativeElement
          .querySelector<HTMLElement>('[data-reference-heading], #workspace-title')
          ?.focus(),
      { injector: this.injector },
    );
  }
  protected selectReference(id: string): void {
    const path = this.router.url.split(/[?#]/, 1)[0];
    if (path === `/design/${id}`) this.drawerOpen.set(false);
  }
  protected variantLabel(count: number): string {
    return formatReferenceCount(count, this.text().language, this.text().variantCount);
  }
  protected retry(): void {
    const url = this.failedUrl();
    void this.router
      .navigateByUrl(url, { onSameUrlNavigation: 'reload' })
      .catch(() => this.failedUrl.set(url));
  }
}
