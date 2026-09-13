import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  AccordionContent,
  AccordionGroup,
  AccordionPanel,
  AccordionTrigger,
} from '@angular/aria/accordion';
import type { FuseResultMatch } from 'fuse.js';
import { I18nService } from '@app/i18n.service';
import { Button } from '@shared/button/button';
import { createFuzzySearch } from '@shared/fuzzy-search';
import { Icon } from '@shared/icon/icon';
import { SearchHighlight, SearchHighlightRegistry } from '@shared/search-highlight';

export interface PermissionPickerOption {
  readonly code: string;
  readonly label: string;
}

interface PermissionResult {
  readonly item: PermissionPickerOption;
  readonly codeMatches: FuseResultMatch['indices'];
  readonly labelMatches: FuseResultMatch['indices'];
}

export interface PermissionSelectionChange {
  readonly code: string;
  readonly selected: boolean;
}

const noMatches: FuseResultMatch['indices'] = [];

@Component({
  selector: 'app-permission-picker',
  imports: [
    AccordionContent,
    AccordionGroup,
    AccordionPanel,
    AccordionTrigger,
    Button,
    Icon,
    SearchHighlight,
  ],
  providers: [SearchHighlightRegistry],
  templateUrl: './permission-picker.html',
  styleUrl: './permission-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionPicker {
  protected readonly i18n = inject(I18nService);
  readonly options = input.required<ReadonlyArray<PermissionPickerOption>>();
  readonly selectedCodes = input.required<ReadonlyArray<string>>();
  readonly disabled = input(false);
  readonly selectionChange = output<PermissionSelectionChange>();
  protected readonly query = signal('');
  private readonly expandedDomains = signal<ReadonlySet<string>>(new Set());
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly searchResults = createFuzzySearch(this.options, this.query, {
    keys: [
      { name: 'code', weight: 0.45 },
      { name: 'label', weight: 0.55 },
    ],
    ignoreDiacritics: true,
    ignoreLocation: true,
    includeMatches: true,
    threshold: 0.35,
  });
  protected readonly groups = computed(() => {
    const results: ReadonlyArray<PermissionResult> = this.searchResults().map(
      ({ item, matches = [] }) => ({
        item,
        codeMatches: matches.find(({ key }) => key === 'code')?.indices ?? noMatches,
        labelMatches: matches.find(({ key }) => key === 'label')?.indices ?? noMatches,
      }),
    );
    return [...new Set(this.options().map(({ code }) => code.split('.')[0] ?? code))]
      .map((domain) => ({
        domain,
        expanded: this.expandedDomains().has(domain),
        selectionLabel: this.i18n.plural('configurationWorkspace.permissionSelection', {
          count: this.selectedCodes().filter((code) => code.startsWith(`${domain}.`)).length,
          total: this.options().filter(({ code }) => code.startsWith(`${domain}.`)).length,
        }),
        permissions: results.filter(({ item }) => item.code.startsWith(`${domain}.`)),
      }))
      .filter(({ permissions }) => permissions.length > 0);
  });

  focusSearch(): void {
    this.searchInput().nativeElement.focus();
  }

  protected updateQuery(input: HTMLInputElement): void {
    this.query.set(input.value.slice(0, 120));
    if (this.query().trim()) {
      this.expandedDomains.update(
        (domains) => new Set([...domains, ...this.groups().map(({ domain }) => domain)]),
      );
    }
  }

  protected setExpanded(domain: string, expanded: boolean): void {
    this.expandedDomains.update((domains) => {
      const next = new Set(domains);
      if (expanded) next.add(domain);
      else next.delete(domain);
      return next;
    });
  }

  protected selected(code: string): boolean {
    return this.selectedCodes().includes(code);
  }
}
