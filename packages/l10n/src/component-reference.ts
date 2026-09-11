type StoryProperty = readonly [name: string, type: string, defaultValue: string];

const buttonVariantProperty: StoryProperty = [
  'ButtonVariant',
  "'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'dark' | 'ghost' | 'link'",
  '—',
];

export interface ComponentReferenceStory {
  readonly properties: readonly StoryProperty[];
  readonly usage: string;
}

interface StoryDescriptions {
  readonly nativeAttribute: string;
  readonly nativeEvent: string;
  readonly ariaAttribute: string;
  readonly projectedContent: string;
  readonly projectedHeading: string;
  readonly projectionSlot: string;
  readonly generatedReadonly: string;
  readonly initialValues: string;
  readonly callerSorts: string;
  readonly hiddenAtZero: string;
  readonly hostStyles: string;
  readonly provider: string;
  readonly routeTemplate: string;
  readonly routeContext: string;
  readonly injectedState: string;
  readonly noInputs: string;
  readonly sharedPreferences: string;
  readonly sharedTheme: string;
  readonly sharedCopy: string;
  readonly confirmationLabel: string;
}

function storyProperties(description: StoryDescriptions) {
  return {
    button: [
      ['variant', 'ButtonVariant', 'default'],
      buttonVariantProperty,
      ['iconOnly', 'boolean', 'false'],
      ['disabled', `boolean · ${description.nativeAttribute}`, 'false'],
      ['type', `'button' | 'submit' | 'reset' · ${description.nativeAttribute}`, 'submit'],
      ['click', `MouseEvent · ${description.nativeEvent}`, '—'],
    ],
    'link-button': [
      ['variant', 'ButtonVariant', 'default'],
      buttonVariantProperty,
      ['iconOnly', 'boolean', 'false'],
      ['routerLink', 'string | readonly any[] | UrlTree | null | undefined', 'undefined'],
      ['href', `string · ${description.nativeAttribute}`, "''"],
    ],
    'action-menu': [
      ['label', 'string', 'required'],
      ['actions', 'readonly MenuAction[]', 'required'],
      ['disabled / iconOnly', 'boolean', 'false'],
      ['appearance', "'button' | 'more'", 'button'],
      ['variant', 'ButtonVariant', 'default'],
      buttonVariantProperty,
      ['actionSelected', 'OutputEmitterRef<string>', '—'],
      [
        'MenuAction',
        '{ readonly id: string; readonly label: string; readonly disabled?: boolean; readonly danger?: boolean }',
        '—',
      ],
    ],
    'split-action': [
      ['primaryLabel / menuLabel', 'string', 'required'],
      ['actions', 'readonly MenuAction[]', 'required'],
      ['primaryDisabled / menuDisabled', 'boolean', 'false'],
      ['variant', 'ButtonVariant', 'primary'],
      buttonVariantProperty,
      ['primaryAction', 'OutputEmitterRef<void>', '—'],
      ['actionSelected', 'OutputEmitterRef<string>', '—'],
    ],
    'icon-toolbar': [
      ['label', 'string', 'required'],
      ['groups', 'readonly IconToolbarGroup<Value>[]', 'required'],
      ['disabled', 'boolean', 'false'],
      ['activated', 'OutputEmitterRef<Value>', '—'],
      [
        'IconToolbarItem<Value>',
        '{ value: Value; label: string; icon: IconName; pressed: boolean | null; disabled: boolean }',
        '—',
      ],
    ],
    'copy-field': [
      ['value / actionLabel', 'string', 'required'],
      ['label / headingId / description / status', 'string', "''"],
      ['href', 'string | undefined', 'undefined'],
      ['external', 'boolean', 'false'],
      ['copy', 'OutputEmitterRef<void>', '—'],
    ],
    'anchor-link': [['fragment', 'string', 'required']],
    badge: [['variant', 'BadgeVariant', 'default']],
    notice: [
      ['variant', 'NoticeVariant', 'info'],
      ['role', `string | null · ${description.ariaAttribute}`, 'null'],
    ],
    'empty-state': [
      ['title', 'string', 'required'],
      ['icon', 'IconName', 'folder'],
      ['<ng-content>', description.projectedContent, '—'],
    ],
    hint: [
      ['text', 'string', 'required'],
      ['id', `string · ${description.generatedReadonly}`, 'hint-*'],
    ],
    'status-block': [['variant', 'StatusBlockVariant', 'primary']],
    icon: [['name', 'IconName', 'required']],
    'entity-icon': [
      ['icon', 'IconName', 'required'],
      ['variant', "'default' | 'info' | 'success' | 'warning' | 'danger'", 'default'],
    ],
    input: [
      ['formField', 'Field<string> | Field<number> | Field<boolean>', 'required'],
      ['type', `string · ${description.nativeAttribute}`, 'text'],
      ['autocomplete / inputmode', `string · ${description.nativeAttribute}`, "''"],
      ['required / disabled / readonly', 'boolean', 'false'],
    ],
    'list-search': [
      ['label', 'string', 'required'],
      ['placeholder', 'string', "''"],
      ['value', 'ModelSignal<string>', "''"],
      ['disabled', 'boolean', 'false'],
      ['touch', 'OutputEmitterRef<void>', '—'],
      ['focus', '(options?: FocusOptions) => void', '—'],
    ],
    'filter-menu': [
      ['label / closeLabel / backLabel', 'string', 'required'],
      ['activeCount', 'number', '0'],
      ['disabled', 'boolean', 'false'],
      ['back / close', '() => void', '—'],
      ['ng-template[appFilterPanel]', description.projectionSlot, '—'],
    ],
    'filter-panel': [
      ['label', 'string', 'required'],
      ['summary', 'string', "''"],
      ['template', `TemplateRef<void> · ${description.generatedReadonly}`, '—'],
    ],
    'filter-choice': [
      ['label / emptyLabel', 'string', 'required'],
      ['options', 'readonly FilterChoiceOption[]', 'required'],
      ['value', 'ModelSignal<string>', "''"],
      ['disabled', 'boolean', 'false'],
      ['committed', 'OutputEmitterRef<string>', '—'],
      ['touch', 'OutputEmitterRef<void>', '—'],
      ['focus', '(options?: FocusOptions) => void', '—'],
      [
        'FilterChoiceOption',
        '{ readonly value: string; readonly label: string; readonly count?: number }',
        '—',
      ],
    ],
    'date-range': [
      ['from / to', `string | undefined · ${description.initialValues}`, 'undefined'],
      ['rangeApplied', 'OutputEmitterRef<DateRange>', '—'],
      ['DateRange', '{ readonly from?: string; readonly to?: string }', '—'],
    ],
    'object-picker': [
      ['label', 'string', 'required'],
      ['options', 'readonly PickerOption[]', 'required'],
      ['disabled', 'boolean', 'false'],
      ['selected', 'OutputEmitterRef<string>', '—'],
      ['focus', '() => void', '—'],
      [
        'PickerOption',
        '{ readonly id: string; readonly label: string; readonly detail?: string }',
        '—',
      ],
    ],
    'field-group': [
      ['legend', 'string', 'required'],
      ['description', 'string', "''"],
    ],
    'data-table': [
      ['tableLayout', "'scroll' | 'fluid'", 'scroll'],
      ['class', "'wide-table' · min-width: 40rem", '—'],
      ['role', `string · ${description.ariaAttribute}`, 'region'],
      ['tabindex', `number · ${description.nativeAttribute}`, '0'],
      ['aria-label', `string · ${description.ariaAttribute}`, "i18n.t('table.scrollRegion')"],
    ],
    'table-sort': [
      ['label', 'string', 'required'],
      ['direction', 'SortDirection', 'none'],
      ['click', `MouseEvent · ${description.callerSorts}`, '—'],
    ],
    'table-export': [
      ['columns', 'readonly string[]', 'required'],
      ['rows', 'readonly (readonly CsvCell[])[]', 'required'],
      ['filename / label / emptyHint / pendingHint', 'string', 'required'],
      ['pending', 'boolean', 'false'],
      ['CsvCell', 'string | number | null', '—'],
    ],
    'filter-chip': [
      ['label', 'string', 'required'],
      ['click', `MouseEvent · ${description.nativeEvent}`, '—'],
    ],
    'bulk-selection': [
      ['count', `number · ${description.hiddenAtZero}`, 'required'],
      ['selectionLabel / clearLabel', 'string', 'required'],
      ['clearSelection', 'OutputEmitterRef<void>', '—'],
    ],
    'list-toolbar': [
      ['[listSearch] / [listFilters] / [listActions]', description.projectionSlot, '—'],
    ],
    'list-workspace': [
      [
        'style',
        description.hostStyles,
        'display: grid; gap: var(--space-4); min-inline-size: 0; align-content: start',
      ],
    ],
    'search-highlight': [
      ['appSearchHighlight', "FuseResultMatch['indices']", 'required'],
      ['SearchHighlightRegistry', description.provider, 'required'],
    ],
    'event-history': [
      ['label', 'string', 'required'],
      ['events', 'readonly HistoryEvent[]', 'required'],
      [
        'HistoryEvent',
        '{ readonly id: string; readonly datetime: string; readonly dateLabel: string; readonly title: string; readonly detail: string }',
        '—',
      ],
    ],
    'localized-date': [
      ['value', 'string | Date', 'required'],
      ['locale', 'string', 'required'],
      ['options', 'Intl.DateTimeFormatOptions', "{ dateStyle: 'short' }"],
    ],
    'detail-row': [['label', 'string', 'required']],
    breadcrumbs: [
      ['label / current', 'string', 'required'],
      ['items', 'readonly BreadcrumbItem[]', 'required'],
      [
        'BreadcrumbItem',
        '{ readonly label: string; readonly path: string | readonly string[]; readonly queryParams?: Params }',
        '—',
      ],
    ],
    tabs: [
      ['label', 'string', 'required'],
      ['tabs', 'readonly TabItem[]', 'required'],
      ['disabled / preserveQuery / preserveFragment', 'boolean', 'false'],
      [
        'TabItem',
        '{ readonly path: string; readonly id: string; readonly label: string; readonly exact?: boolean; readonly queryParams?: Params; readonly active?: boolean }',
        '—',
      ],
    ],
    'tab-layout': [
      ['appTabPanel', 'string', 'required'],
      ['TabPanel.template', `TemplateRef<unknown> · ${description.generatedReadonly}`, '—'],
      ['route.data.panel', `string · ${description.routeTemplate}`, 'required'],
      ['route.data', `Data · ${description.routeContext}`, '{}'],
    ],
    drawer: [
      ['open', 'boolean', 'false'],
      ['label / closeLabel', 'string', 'required'],
      ['closeButtonHeight', 'string | undefined', 'undefined'],
      ['[drawerHeading]', description.projectionSlot, 'label()'],
      ['closed', 'OutputEmitterRef<void>', '—'],
    ],
    confirmation: [
      ['request', '(message: string, options?: ConfirmationOptions) => Promise<boolean>', '—'],
      ['options.acceptLabel', 'string | undefined', description.confirmationLabel],
      ['options.variant', "'primary' | 'danger' | undefined", 'primary'],
    ],
    'result-navigation': [
      ['label / rangeLabel / previousLabel / nextLabel', 'string', 'required'],
      ['previousDisabled / nextDisabled', 'boolean', 'true'],
      ['previous / next', 'OutputEmitterRef<void>', '—'],
    ],
    'page-header': [
      ['layout', "'inline' | 'stacked'", 'inline'],
      ['[pageBack]', description.projectionSlot, '—'],
      ['[pageBadges]', description.projectionSlot, '—'],
      ['[pageActions]', description.projectionSlot, '—'],
      ['<ng-content>', description.projectedHeading, '—'],
    ],
    'outcome-panel': [['<ng-content>', description.projectedContent, '—']],
    'visual-sample': [['name', 'string', 'required']],
    'process-timeline': [
      ['steps', 'readonly TimelineStep[]', 'required'],
      ['TimelineStep', '{ title: string; description: string }', '—'],
    ],
    'concrete-examples': [
      ['anchor', 'string', 'cas-concrets'],
      ['context', "'expertise' | 'examples'", 'examples'],
    ],
    'contact-actions': [
      ['mailLabel / bookLabel', 'string', 'required'],
      ['subject / body', 'string', "''"],
    ],
    'site-header': [['inputs', description.noInputs, description.sharedPreferences]],
    'mobile-navigation': [
      [
        'MOBILE_NAVIGATION',
        `InjectionToken<MobileNavigationState> · ${description.injectedState}`,
        'required',
      ],
      ['provideMobileNavigation', '() => Provider', '—'],
      ['MobileNavigationState.open', 'WritableSignal<boolean>', 'false'],
      ['MobileNavigationState.toggle', '(trigger: HTMLElement) => void', '—'],
      ['MobileNavigationState.close', '() => void', '—'],
    ],
    'site-footer': [['showPreferences', 'boolean', 'false']],
    'language-selector': [['compact', 'boolean', 'false']],
    'theme-toggle': [['inputs', description.noInputs, description.sharedTheme]],
    'new-label': [['inputs', description.noInputs, description.sharedCopy]],
    'back-office-header': [
      ['administrator', 'boolean', 'false'],
      ['searchShortcut', 'boolean', 'true'],
      [
        'Authentication.currentAccount',
        '() => Promise<CurrentAccountValue | undefined>',
        description.injectedState,
      ],
      ['Router', description.provider, 'required'],
    ],
    'back-office-nav': [
      ['inputs', description.noInputs, '—'],
      ['Router.url / Router.events', 'string / Observable<Event>', description.routeContext],
    ],
    'global-search': [
      ['shortcutEnabled', 'boolean', 'false'],
      ['ClientsApi.list', '() => Promise<ClientListValue>', description.provider],
      ['QuotesApi.list', '() => Promise<QuoteListValue>', description.provider],
      ['OrdersApi.list', '() => Promise<OrderListValue>', description.provider],
      ['InvoicesApi.list', '() => Promise<InvoiceListValue>', description.provider],
      ['Router', description.provider, 'required'],
    ],
    'document-issues': [
      ['issues', 'ReadonlyArray<DocumentIssueValue>', 'required'],
      ['clientId', 'UlidValue', 'required'],
      ['kind', "'quote' | 'invoice'", 'required'],
      [
        'DocumentIssueValue',
        "{ readonly party: 'issuer' | 'client'; readonly field: 'displayName' | 'addressLine1' | 'city' | 'country' | 'email'; readonly reason: 'required' | 'invalid_email' }",
        '—',
      ],
    ],
    'mermaid-diagrams': [
      ['inputs', description.noInputs, '—'],
      ['pre.mermaid', description.projectedContent, '—'],
      ['securityLevel', "'strict'", 'strict'],
      [
        'theme / startOnLoad / suppressErrors',
        "'neutral' / false / true",
        'neutral / false / true',
      ],
    ],
    'copy-notice': [
      ['inputs', description.noInputs, '—'],
      ['AnchorCopy', description.provider, 'required'],
      ['AnchorCopy.copy', '(fragment: string, message: string) => Promise<void>', '—'],
      ['AnchorCopy.message', 'WritableSignal<string | null>', 'null'],
    ],
  } satisfies Record<string, readonly StoryProperty[]>;
}

type StoryId = keyof ReturnType<typeof storyProperties>;

function storyDefinitions(
  descriptions: StoryDescriptions,
  usage: Readonly<Record<StoryId, string>>,
): Readonly<Record<string, ComponentReferenceStory>> {
  const examples: Readonly<Record<string, string>> = usage;
  return Object.fromEntries(
    Object.entries(storyProperties(descriptions)).map(([id, properties]) => [
      id,
      { properties, usage: examples[id] },
    ]),
  );
}

const frenchStories = /* @__PURE__ */ storyDefinitions(
  {
    nativeAttribute: 'Attribut HTML natif',
    nativeEvent: 'Événement DOM natif',
    ariaAttribute: 'Attribut ARIA',
    projectedContent: 'Contenu projeté',
    projectedHeading: 'Titre et description projetés',
    projectionSlot: 'Emplacement de contenu projeté',
    generatedReadonly: 'Fourni par le composant, en lecture seule',
    initialValues: 'Valeurs lues à l’initialisation du composant',
    callerSorts: 'Le composant appelant trie les lignes',
    hiddenAtZero: 'La barre est masquée à zéro',
    hostStyles: 'Styles appliqués par la directive à son élément hôte',
    provider: 'Fournisseur Angular du composant appelant',
    routeTemplate: 'Nom du modèle appTabPanel à afficher',
    routeContext: 'Contexte transmis au modèle',
    injectedState: 'État injecté dans le composant',
    noInputs: 'Aucune propriété d’entrée',
    sharedPreferences: 'Langue et thème partagés',
    sharedTheme: 'Thème partagé',
    sharedCopy: 'Texte partagé du site',
    confirmationLabel: 'Libellé traduit de confirmation.accept',
  },
  {
    button:
      '<button appButton type="button" variant="primary" (click)="preview()">Aperçu</button>\n<!-- ghost partage les surfaces des onglets et de la barre d’icônes. link reste souligné. -->\n<button appButton type="button" variant="ghost" (click)="preview()">Aperçu secondaire</button>',
    'link-button':
      '<a appLinkButton variant="ghost" routerLink="/design/button">Référence du bouton</a>\n<a appLinkButton variant="link" routerLink="/design/button">Lien souligné</a>',
    'action-menu':
      '<!-- more utilise la variante ghost et conserve un libellé accessible. -->\n<app-action-menu appearance="more" label="Actions" [actions]="[{id: \'edit\', label: \'Modifier\'}]" (actionSelected)="command.set($event)" />',
    'split-action':
      '<app-split-action primaryLabel="Aperçu" menuLabel="Autres aperçus" [actions]="actions" (primaryAction)="preview()" (actionSelected)="command.set($event)" />',
    'icon-toolbar':
      '<app-icon-toolbar label="Mise en forme" [groups]="groups" [disabled]="saving()" (activated)="format($event)" />',
    'copy-field':
      '<app-copy-field label="Exemple" value="DEMO-1" actionLabel="Copier" (copy)="copyExample()" />',
    'anchor-link': '<h2 id="example">Exemple <app-anchor-link fragment="example" /></h2>',
    badge: '<span appBadge variant="success">Prêt</span>',
    notice: '<p appNotice variant="warning" role="status">Vérifiez l’exemple local.</p>',
    'empty-state':
      '<app-empty-state title="Aucun exemple"><button appButton type="button" (click)="reset()">Réinitialiser</button></app-empty-state>',
    hint: '<app-hint #hint text="Exemple local"><button appButton type="button" [attr.aria-describedby]="hint.id">Aide</button></app-hint>',
    'status-block':
      '<section appStatusBlock variant="success"><h3>Prêt</h3><p>Exemple local</p></section>',
    icon: '<button appButton type="button" aria-label="Rechercher"><app-icon name="search" /></button>',
    'entity-icon':
      '<span class="spacer-x-3"><app-entity-icon icon="invoice" variant="success" />Facture payée</span>',
    input:
      'value = signal(\'\');\nfield = form(this.value, (path) => { required(path); email(path); });\n\n<label>Courriel<input type="email" autocomplete="email" [formField]="field" /></label>',
    'list-search': '<app-list-search label="Rechercher" [formField]="filters.query" />',
    'filter-menu':
      '<app-filter-menu #menu label="Filtres" closeLabel="Fermer" backLabel="Retour"><ng-template appFilterPanel label="État"><app-filter-choice label="Rechercher" emptyLabel="Aucun choix" [options]="options" [formField]="filters.status" (committed)="menu.back()" /></ng-template></app-filter-menu>',
    'filter-panel':
      '<ng-template appFilterPanel label="État" [summary]="selectedLabel()">\n  <app-filter-choice label="Rechercher" emptyLabel="Aucun choix" [options]="options" [formField]="filters.status" />\n</ng-template>',
    'filter-choice':
      '<app-filter-choice label="Rechercher un choix" emptyLabel="Aucun choix" [options]="options" [formField]="filters.status" (committed)="selected.set($event)" />',
    'date-range':
      '<app-date-range-filter from="2026-09-01" to="2026-09-30" (rangeApplied)="range.set($event)" />',
    'object-picker':
      '<app-object-picker label="Choisir" [options]="[{id: \'angular\', label: \'Angular\', detail: \'Web\'}]" (selected)="selected.set($event)" />',
    'field-group':
      '<fieldset appFieldGroup legend="Contact" description="Exemple local"><label class="field">Courriel<input class="input" type="email" [formField]="contact.email" /></label></fieldset>',
    'data-table':
      '<div appDataTable tableLayout="fluid"><table><caption>Exemples</caption><thead><tr><th>Nom</th></tr></thead><tbody><tr><td>Atlas</td></tr></tbody></table></div>',
    'table-sort':
      '<th [attr.aria-sort]="direction()"><button appTableSort label="Nom" [direction]="direction()" (click)="sort()"></button></th>',
    'table-export':
      '<app-table-export [columns]="[\'Nom\']" [rows]="[[\'Atlas\']]" filename="examples.csv" label="Exporter" emptyHint="Aucune ligne" pendingHint="Chargement en cours" />',
    'filter-chip': '<button appFilterChip label="Brouillon" (click)="clearFilter()"></button>',
    'bulk-selection':
      '<app-bulk-selection [count]="selected().length" selectionLabel="Sélection" clearLabel="Effacer" (clearSelection)="selected.set([])"><button appButton type="button">Action locale</button></app-bulk-selection>',
    'list-toolbar':
      '<app-list-toolbar><app-list-search listSearch label="Rechercher" [(value)]="query" /><p listSummary>Exemples locaux</p></app-list-toolbar>',
    'list-workspace':
      '<section appListWorkspace>\n  <app-list-toolbar><app-list-search listSearch label="Rechercher" [(value)]="query" /></app-list-toolbar>\n  <div appDataTable><table><caption>Exemples</caption><thead><tr><th>Nom</th></tr></thead><tbody><tr><td>Atlas</td></tr></tbody></table></div>\n</section>',
    'search-highlight':
      '// Les composants partagent le surlignage CSS. Chaque fournisseur nettoie ses propres plages.\nproviders: [SearchHighlightRegistry]\n\n<span [appSearchHighlight]="[[0, 2]]">Atlas</span>',
    'event-history': '<app-event-history label="Historique local" [events]="events" />',
    'localized-date': "{{ '2026-09-10' | localizedDate: 'fr': { dateStyle: 'long' } }}",
    'detail-row': '<p appDetailRow label="Référence">DEMO-1</p>',
    breadcrumbs:
      '<app-breadcrumbs label="Fil d’Ariane" [items]="[{label: \'Composants\', path: \'/design\'}]" current="Exemple" />',
    tabs: "<app-tabs label=\"Exemple\" [tabs]=\"[{path: 'first', id: 'first-tab', label: 'Aperçu'}, {path: 'second', id: 'second-tab', label: 'Détails'}]\" />",
    'tab-layout':
      '<section appTabLayout><app-tabs label="Exemple" [tabs]="tabs" /><router-outlet /><ng-template appTabPanel="example" let-tab="tab"><p>{{ tab }}</p></ng-template></section>\n\n// Route enfant\n{path: \'first\', component: TabPanelOutlet, data: {panel: \'example\', tab: \'first\'}}',
    drawer:
      '<button appButton type="button" (click)="open.set(true)">Ouvrir</button>\n<app-drawer [open]="open()" label="Exemple" closeLabel="Fermer" (closed)="open.set(false)"><p>Contenu local</p></app-drawer>',
    confirmation:
      "const confirmed = await confirmation.request('Appliquer cet exemple local ?', {acceptLabel: 'Appliquer', variant: 'primary'});",
    'result-navigation':
      '<app-result-navigation label="Pages" rangeLabel="1–3 sur 6" previousLabel="Précédent" nextLabel="Suivant" [previousDisabled]="true" [nextDisabled]="false" (next)="nextPage()" />',
    'page-header':
      '<app-page-header><h1>Exemples</h1><p>Données locales</p><button pageActions appButton type="button">Aperçu</button></app-page-header>',
    'outcome-panel':
      '<aside appOutcomePanel aria-labelledby="summary"><h2 id="summary">Résumé</h2><p>Exemple local</p></aside>',
    'visual-sample': '<app-visual-sample name="Exemple"><p>Contenu local</p></app-visual-sample>',
    'process-timeline':
      "<app-process-timeline [steps]=\"[{title: 'Aperçu', description: 'Vérifiez l’exemple local.'}]\" />",
    'concrete-examples': '<app-concrete-examples anchor="examples" context="expertise" />',
    'contact-actions':
      '<!-- Fournissez du texte non encodé. L’objet reste sur une ligne. Le corps conserve ses retours à la ligne. -->\n<app-contact-actions mailLabel="Courriel" bookLabel="Réserver un appel" subject="Exemple C++" body="Aperçu local" />',
    'site-header': '<app-site-header />',
    'mobile-navigation':
      'providers: [provideMobileNavigation()]\nnavigation = inject(MOBILE_NAVIGATION);\n\n<button #trigger type="button" (click)="navigation.toggle(trigger)">Ouvrir</button>\n@if (navigation.open()) { <app-mobile-navigation /> }',
    'site-footer': '<app-site-footer [showPreferences]="true" />',
    'language-selector': '<app-language-selector [compact]="true" />',
    'theme-toggle': '<app-theme-toggle />',
    'new-label': '<app-new-label />',
    'back-office-header':
      '<!-- Le shell fournit la grille sidebar/header/content. -->\n<app-back-office-header [administrator]="true" />',
    'back-office-nav':
      '<!-- L’état actif suit Router.url et NavigationEnd. -->\n<app-back-office-nav />',
    'global-search':
      '<!-- Fournissez ClientsApi, QuotesApi, OrdersApi et InvoicesApi dans le contexte administrateur. -->\n<app-global-search />',
    'document-issues':
      '<app-document-issues [issues]="[{party: \'client\', field: \'email\', reason: \'invalid_email\'}]" [clientId]="clientId" kind="quote" />',
    'mermaid-diagrams':
      '<section appMermaidDiagrams>\n  <pre class="mermaid">flowchart LR\n    A[Aperçu] --> B[Validation locale]</pre>\n</section>\n<!-- Le composant conserve securityLevel: strict. Aucun HTML non fiable n’est injecté. -->',
    'copy-notice':
      'anchorCopy = inject(AnchorCopy);\n\n<button type="button" (click)="anchorCopy.copy(\'example\', \'Lien copié\')">Copier le lien</button>\n<!-- Le shell contient déjà <app-copy-notice />. Ne le dupliquez pas. -->',
  },
);

const englishStories = /* @__PURE__ */ storyDefinitions(
  {
    nativeAttribute: 'Native HTML attribute',
    nativeEvent: 'Native DOM event',
    ariaAttribute: 'ARIA attribute',
    projectedContent: 'Projected content',
    projectedHeading: 'Projected heading and description',
    projectionSlot: 'Content projection slot',
    generatedReadonly: 'Provided by the component; read-only',
    initialValues: 'Values read when the component initializes',
    callerSorts: 'The calling component sorts the rows',
    hiddenAtZero: 'The bar is hidden at zero',
    hostStyles: 'Styles applied by the directive to its host element',
    provider: 'Angular provider of the calling component',
    routeTemplate: 'Name of the appTabPanel template to display',
    routeContext: 'Context passed to the template',
    injectedState: 'State injected into the component',
    noInputs: 'No input properties',
    sharedPreferences: 'Shared language and theme',
    sharedTheme: 'Shared theme',
    sharedCopy: 'Shared website text',
    confirmationLabel: 'Translated confirmation.accept label',
  },
  {
    button:
      '<button appButton type="button" variant="primary" (click)="preview()">Preview</button>\n<!-- ghost shares tab and icon toolbar surfaces. link stays underlined. -->\n<button appButton type="button" variant="ghost" (click)="preview()">Secondary preview</button>',
    'link-button':
      '<a appLinkButton variant="ghost" routerLink="/design/button">Button reference</a>\n<a appLinkButton variant="link" routerLink="/design/button">Underlined link</a>',
    'action-menu':
      '<!-- more uses the ghost variant and keeps an accessible label. -->\n<app-action-menu appearance="more" label="Actions" [actions]="[{id: \'edit\', label: \'Edit\'}]" (actionSelected)="command.set($event)" />',
    'split-action':
      '<app-split-action primaryLabel="Preview" menuLabel="More previews" [actions]="actions" (primaryAction)="preview()" (actionSelected)="command.set($event)" />',
    'icon-toolbar':
      '<app-icon-toolbar label="Formatting" [groups]="groups" [disabled]="saving()" (activated)="format($event)" />',
    'copy-field':
      '<app-copy-field label="Example" value="DEMO-1" actionLabel="Copy" (copy)="copyExample()" />',
    'anchor-link': '<h2 id="example">Example <app-anchor-link fragment="example" /></h2>',
    badge: '<span appBadge variant="success">Ready</span>',
    notice: '<p appNotice variant="warning" role="status">Check the local example.</p>',
    'empty-state':
      '<app-empty-state title="No examples"><button appButton type="button" (click)="reset()">Reset</button></app-empty-state>',
    hint: '<app-hint #hint text="Local example"><button appButton type="button" [attr.aria-describedby]="hint.id">Help</button></app-hint>',
    'status-block':
      '<section appStatusBlock variant="success"><h3>Ready</h3><p>Local example</p></section>',
    icon: '<button appButton type="button" aria-label="Search"><app-icon name="search" /></button>',
    'entity-icon':
      '<span class="spacer-x-3"><app-entity-icon icon="invoice" variant="success" />Paid invoice</span>',
    input:
      'value = signal(\'\');\nfield = form(this.value, (path) => { required(path); email(path); });\n\n<label>Email<input type="email" autocomplete="email" [formField]="field" /></label>',
    'list-search': '<app-list-search label="Search" [formField]="filters.query" />',
    'filter-menu':
      '<app-filter-menu #menu label="Filters" closeLabel="Close" backLabel="Back"><ng-template appFilterPanel label="Status"><app-filter-choice label="Search" emptyLabel="No choices" [options]="options" [formField]="filters.status" (committed)="menu.back()" /></ng-template></app-filter-menu>',
    'filter-panel':
      '<ng-template appFilterPanel label="Status" [summary]="selectedLabel()">\n  <app-filter-choice label="Search" emptyLabel="No choices" [options]="options" [formField]="filters.status" />\n</ng-template>',
    'filter-choice':
      '<app-filter-choice label="Search choices" emptyLabel="No choices" [options]="options" [formField]="filters.status" (committed)="selected.set($event)" />',
    'date-range':
      '<app-date-range-filter from="2026-09-01" to="2026-09-30" (rangeApplied)="range.set($event)" />',
    'object-picker':
      '<app-object-picker label="Choose" [options]="[{id: \'angular\', label: \'Angular\', detail: \'Web\'}]" (selected)="selected.set($event)" />',
    'field-group':
      '<fieldset appFieldGroup legend="Contact" description="Local example"><label class="field">Email<input class="input" type="email" [formField]="contact.email" /></label></fieldset>',
    'data-table':
      '<div appDataTable tableLayout="fluid"><table><caption>Examples</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Atlas</td></tr></tbody></table></div>',
    'table-sort':
      '<th [attr.aria-sort]="direction()"><button appTableSort label="Name" [direction]="direction()" (click)="sort()"></button></th>',
    'table-export':
      '<app-table-export [columns]="[\'Name\']" [rows]="[[\'Atlas\']]" filename="examples.csv" label="Export" emptyHint="No rows" pendingHint="Loading" />',
    'filter-chip': '<button appFilterChip label="Draft" (click)="clearFilter()"></button>',
    'bulk-selection':
      '<app-bulk-selection [count]="selected().length" selectionLabel="Selected" clearLabel="Clear" (clearSelection)="selected.set([])"><button appButton type="button">Local action</button></app-bulk-selection>',
    'list-toolbar':
      '<app-list-toolbar><app-list-search listSearch label="Search" [(value)]="query" /><p listSummary>Local examples</p></app-list-toolbar>',
    'list-workspace':
      '<section appListWorkspace>\n  <app-list-toolbar><app-list-search listSearch label="Search" [(value)]="query" /></app-list-toolbar>\n  <div appDataTable><table><caption>Examples</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Atlas</td></tr></tbody></table></div>\n</section>',
    'search-highlight':
      '// Components share the CSS highlight. Each provider cleans up its own ranges.\nproviders: [SearchHighlightRegistry]\n\n<span [appSearchHighlight]="[[0, 2]]">Atlas</span>',
    'event-history': '<app-event-history label="Local history" [events]="events" />',
    'localized-date': "{{ '2026-09-10' | localizedDate: 'en': { dateStyle: 'long' } }}",
    'detail-row': '<p appDetailRow label="Reference">DEMO-1</p>',
    breadcrumbs:
      '<app-breadcrumbs label="Breadcrumb" [items]="[{label: \'Components\', path: \'/design\'}]" current="Example" />',
    tabs: "<app-tabs label=\"Example\" [tabs]=\"[{path: 'first', id: 'first-tab', label: 'Preview'}, {path: 'second', id: 'second-tab', label: 'Details'}]\" />",
    'tab-layout':
      '<section appTabLayout><app-tabs label="Example" [tabs]="tabs" /><router-outlet /><ng-template appTabPanel="example" let-tab="tab"><p>{{ tab }}</p></ng-template></section>\n\n// Child route\n{path: \'first\', component: TabPanelOutlet, data: {panel: \'example\', tab: \'first\'}}',
    drawer:
      '<button appButton type="button" (click)="open.set(true)">Open</button>\n<app-drawer [open]="open()" label="Example" closeLabel="Close" (closed)="open.set(false)"><p>Local content</p></app-drawer>',
    confirmation:
      "const confirmed = await confirmation.request('Apply this local example?', {acceptLabel: 'Apply', variant: 'primary'});",
    'result-navigation':
      '<app-result-navigation label="Pages" rangeLabel="1–3 of 6" previousLabel="Previous" nextLabel="Next" [previousDisabled]="true" [nextDisabled]="false" (next)="nextPage()" />',
    'page-header':
      '<app-page-header><h1>Examples</h1><p>Local data</p><button pageActions appButton type="button">Preview</button></app-page-header>',
    'outcome-panel':
      '<aside appOutcomePanel aria-labelledby="summary"><h2 id="summary">Summary</h2><p>Local example</p></aside>',
    'visual-sample': '<app-visual-sample name="Example"><p>Local content</p></app-visual-sample>',
    'process-timeline':
      "<app-process-timeline [steps]=\"[{title: 'Preview', description: 'Check the local example.'}]\" />",
    'concrete-examples': '<app-concrete-examples anchor="examples" context="expertise" />',
    'contact-actions':
      '<!-- Supply unencoded text. The subject stays on one line. The body keeps its line breaks. -->\n<app-contact-actions mailLabel="Email" bookLabel="Book a call" subject="C++ example" body="Local preview" />',
    'site-header': '<app-site-header />',
    'mobile-navigation':
      'providers: [provideMobileNavigation()]\nnavigation = inject(MOBILE_NAVIGATION);\n\n<button #trigger type="button" (click)="navigation.toggle(trigger)">Open</button>\n@if (navigation.open()) { <app-mobile-navigation /> }',
    'site-footer': '<app-site-footer [showPreferences]="true" />',
    'language-selector': '<app-language-selector [compact]="true" />',
    'theme-toggle': '<app-theme-toggle />',
    'new-label': '<app-new-label />',
    'back-office-header':
      '<!-- The shell provides the sidebar/header/content grid. -->\n<app-back-office-header [administrator]="true" />',
    'back-office-nav':
      '<!-- The active item follows Router.url and NavigationEnd. -->\n<app-back-office-nav />',
    'global-search':
      '<!-- Provide ClientsApi, QuotesApi, OrdersApi and InvoicesApi in the administrator context. -->\n<app-global-search />',
    'document-issues':
      '<app-document-issues [issues]="[{party: \'client\', field: \'email\', reason: \'invalid_email\'}]" [clientId]="clientId" kind="quote" />',
    'mermaid-diagrams':
      '<section appMermaidDiagrams>\n  <pre class="mermaid">flowchart LR\n    A[Preview] --> B[Local validation]</pre>\n</section>\n<!-- The component keeps securityLevel: strict. No untrusted HTML is injected. -->',
    'copy-notice':
      'anchorCopy = inject(AnchorCopy);\n\n<button type="button" (click)="anchorCopy.copy(\'example\', \'Link copied\')">Copy link</button>\n<!-- The shell already contains <app-copy-notice />. Do not duplicate it. -->',
  },
);

const referenceHighlights: readonly (readonly [number, number][])[] = [[], [[0, 2]]];

const referenceExamples = {
  firstName: 'Atlas',
  firstValue: 'DEMO-1',
  secondName: 'Boréal',
  secondValue: 'DEMO-2',
  formula: '=1+1',
  formulaValue: 'DEMO-3',
  email: 'contact@example.com',
  date: '2026-09-10',
  datetime: '2026-09-10T09:00:00.000Z',
  from: '2026-09-01',
  to: '2026-09-30',
  filename: 'reference-examples.csv',
  technology: 'TypeScript',
  channel: 'Web',
  highlights: referenceHighlights,
  accountId: '01K00000000000000000000001',
  clientId: '01K00000000000000000000002',
  quoteId: '01K00000000000000000000003',
  orderId: '01K00000000000000000000004',
  invoiceId: '01K00000000000000000000005',
  revisionId: '01K00000000000000000000006',
  quoteReference: 'DE-2026-000001',
  orderReference: 'CO-2026-000001',
  address: '1 rue des Exemples',
  postalCode: '75001',
  city: 'Paris',
  country: 'FR',
};

export const componentReferenceText = {
  fr: {
    stories: frenchStories,
    examples: {
      ...referenceExamples,
      tableName: 'Atlas — étude et développement du système de gestion des interventions',
    },
    tableLayouts: {
      scroll:
        'Le texte reste sur une ligne. Le tableau défile horizontalement si son contenu dépasse la largeur disponible.',
      fluid:
        'Le tableau prend la largeur disponible. Le texte revient à la ligne dans les cellules.',
    },
    wideTable:
      'Pour un tableau métier à nombreuses colonnes, la classe wide-table conserve une largeur minimale de 40 rem.',
    language: 'fr',
    componentCount: { one: '{count} composant', other: '{count} composants' },
    variantCount: { one: '{count} variante présentée', other: '{count} variantes présentées' },
    title: 'Bibliothèque de composants',
    back: 'Retour au site',
    search: 'Rechercher un composant',
    navigation: 'Composants',
    open: 'Ouvrir les composants',
    close: 'Fermer les composants',
    clear: 'Effacer la recherche',
    noResults: 'Aucun composant ne correspond. Effacez la recherche.',
    preview: 'Aperçu interactif',
    controls: 'Réglages de l’aperçu',
    variants: 'Variantes présentées',
    properties: 'Propriétés et événements',
    property: 'Propriété',
    type: 'Type',
    default: 'Valeur par défaut',
    usage: 'Exemple d’utilisation',
    source: 'Source',
    required: 'Obligatoire',
    none: 'Aucune',
    local:
      'Les réglages restent sur cette page. Aucune opération métier ni requête API n’est exécutée.',
    loading: 'Chargement de la page…',
    failed: 'Le composant n’a pas pu être chargé. Réessayez.',
    retry: 'Réessayer',
    label: 'Libellé',
    description: 'Description',
    value: 'Valeur',
    variant: 'Variante',
    disabled: 'Désactivé',
    iconOnly: 'Icône seule',
    icon: 'Icône',
    placeholder: 'Texte indicatif',
    empty: 'Sans données',
    pending: 'Chargement simulé',
    count: 'Nombre',
    titleField: 'Titre',
    name: 'Nom',
    email: 'Courriel',
    validate: 'Valider localement',
    invalid: 'Saisissez une adresse courriel valide.',
    execute: 'Exécuter localement',
    events: 'Dernier événement local',
    reset: 'Réinitialiser',
    choose: 'Choisir un exemple',
    searchChoices: 'Rechercher un choix',
    noChoices: 'Aucun choix correspondant',
    filters: 'Filtres',
    closeFilters: 'Fermer les filtres',
    backFilters: 'Retour aux filtres',
    status: 'État',
    all: 'Tous',
    draft: 'Brouillon',
    ready: 'Prêt',
    period: 'Période',
    from: 'Date de début',
    to: 'Date de fin',
    apply: 'Appliquer',
    clearSelection: 'Effacer la sélection',
    previous: 'Précédent',
    next: 'Suivant',
    current: 'Page actuelle',
    details: 'Détails',
    export: 'Exporter les exemples (CSV)',
    exportEmpty: 'Aucune ligne à exporter.',
    exportPending: 'Attendez la fin du chargement simulé.',
    edit: 'Modifier',
    remove: 'Supprimer localement',
    unavailable: 'Action indisponible',
    confirm: 'Confirmer l’exemple',
    confirmation: 'Confirmer cette action locale ? Aucune donnée réelle ne sera modifiée.',
    accepted: 'Action locale confirmée',
    cancelled: 'Action locale annulée',
    content: 'Contenu de démonstration',
    copy: 'Copier l’exemple',
    copied: 'Événement de copie reçu',
    compact: 'Présentation compacte',
    preferences: 'Afficher les préférences',
    selectors: 'Sélecteurs associés',
    accountPreview: 'Aperçu du contexte de compte',
    isolatedAccount:
      'Ce compte et ses documents sont fictifs. Les liens affichent leur destination sans quitter la référence.',
    completePreview: 'Rétablir les données locales',
    retryPreview:
      'Après rétablissement, replacez le focus dans la recherche. Pour le compte, utilisez Réessayer.',
    errorPreview: 'Erreur simulée',
    administrator: 'Compte administrateur',
    destination: 'Destination interceptée',
    affairs: 'Affaires',
    quoteDetail: 'Détail d’un devis',
    billing: 'Facturation',
    company: 'Entreprise',
    noActivePage: 'Aucune page active',
    quote: 'Devis',
    invoice: 'Facture',
    bothParties: 'Émetteur et client',
    issuer: 'Émetteur',
    client: 'Client',
    searchPreview:
      'Recherchez Atlas pour afficher les quatre catégories. Choisissez un état pour examiner le chargement, l’erreur ou une liste vide.',
    singleBusinessPreview:
      'Un seul composant réel est affiché. Les réglages présentent ses états sans dupliquer les identifiants ou les dialogues.',
    copyNoticePreview:
      'Le bouton copie un lien avec AnchorCopy. La notice globale existante affiche le message puis disparaît après 2,4 secondes.',
    copyNoticeMessage: 'Lien de démonstration copié',
    diagram: 'Diagramme',
    flowchart: 'Flux',
    sequence: 'Séquence',
    diagramSafety:
      'Seuls ces diagrammes prédéfinis sont rendus. Mermaid conserve son mode strict et son chargement différé.',
    diagrams: {
      flowchart:
        'flowchart LR\n  accTitle: Flux local\n  accDescr: Un aperçu suivi d’une validation locale.\n  A[Aperçu] --> B[Validation locale]',
      sequence:
        'sequenceDiagram\n  accTitle: Séquence locale\n  accDescr: Une demande et une réponse entre deux acteurs fictifs.\n  participant A as Aperçu\n  participant B as Données locales\n  A->>B: Lire\n  B-->>A: Exemple',
    },
    samePreview:
      'L’aperçu ci-dessus présente cette variante. Redimensionnez la fenêtre pour examiner son comportement adaptatif.',
    resultCount: { one: '{count} résultat', other: '{count} résultats' },
    groups: {
      actions: 'Actions',
      feedback: 'Messages et états',
      fields: 'Saisie et filtres',
      data: 'Listes et données',
      navigation: 'Navigation et dialogues',
      presentation: 'Présentation du site',
      compositions: 'Compositions',
    },
  },
  en: {
    stories: englishStories,
    examples: {
      ...referenceExamples,
      tableName: 'Atlas — analysis and development of the intervention management system',
    },
    tableLayouts: {
      scroll:
        'Text stays on one line. The table scrolls horizontally when its content exceeds the available width.',
      fluid: 'The table uses the available width. Text wraps inside the cells.',
    },
    wideTable:
      'For a business table with many columns, the wide-table class keeps a minimum width of 40 rem.',
    language: 'en',
    componentCount: { one: '{count} component', other: '{count} components' },
    variantCount: { one: '{count} displayed variant', other: '{count} displayed variants' },
    title: 'Component library',
    back: 'Back to the website',
    search: 'Search components',
    navigation: 'Components',
    open: 'Open components',
    close: 'Close components',
    clear: 'Clear search',
    noResults: 'No components match. Clear the search.',
    preview: 'Interactive preview',
    controls: 'Preview controls',
    variants: 'Displayed variants',
    properties: 'Properties and events',
    property: 'Property',
    type: 'Type',
    default: 'Default value',
    usage: 'Usage example',
    source: 'Source',
    required: 'Required',
    none: 'None',
    local: 'Controls remain on this page. No business operation or API request runs.',
    loading: 'Loading the page…',
    failed: 'The component did not load. Try again.',
    retry: 'Try again',
    label: 'Label',
    description: 'Description',
    value: 'Value',
    variant: 'Variant',
    disabled: 'Disabled',
    iconOnly: 'Icon only',
    icon: 'Icon',
    placeholder: 'Placeholder',
    empty: 'No data',
    pending: 'Simulated loading',
    count: 'Count',
    titleField: 'Title',
    name: 'Name',
    email: 'Email',
    validate: 'Validate locally',
    invalid: 'Enter a valid email address.',
    execute: 'Run locally',
    events: 'Last local event',
    reset: 'Reset',
    choose: 'Choose an example',
    searchChoices: 'Search choices',
    noChoices: 'No matching choices',
    filters: 'Filters',
    closeFilters: 'Close filters',
    backFilters: 'Back to filters',
    status: 'Status',
    all: 'All',
    draft: 'Draft',
    ready: 'Ready',
    period: 'Period',
    from: 'Start date',
    to: 'End date',
    apply: 'Apply',
    clearSelection: 'Clear selection',
    previous: 'Previous',
    next: 'Next',
    current: 'Current page',
    details: 'Details',
    export: 'Export examples (CSV)',
    exportEmpty: 'No rows to export.',
    exportPending: 'Wait for simulated loading to finish.',
    edit: 'Edit',
    remove: 'Delete locally',
    unavailable: 'Unavailable action',
    confirm: 'Confirm example',
    confirmation: 'Confirm this local action? No real data will change.',
    accepted: 'Local action confirmed',
    cancelled: 'Local action cancelled',
    content: 'Example content',
    copy: 'Copy example',
    copied: 'Copy event received',
    compact: 'Compact layout',
    preferences: 'Show preferences',
    selectors: 'Related selectors',
    accountPreview: 'Account context preview',
    isolatedAccount:
      'This account and its documents are fictitious. Links show their destination without leaving the reference.',
    completePreview: 'Restore local data',
    retryPreview: 'After restoring data, focus the search field again. For the account, use Retry.',
    errorPreview: 'Simulated error',
    administrator: 'Administrator account',
    destination: 'Intercepted destination',
    affairs: 'Affairs',
    quoteDetail: 'Quote detail',
    billing: 'Billing',
    company: 'Company',
    noActivePage: 'No active page',
    quote: 'Quote',
    invoice: 'Invoice',
    bothParties: 'Issuer and client',
    issuer: 'Issuer',
    client: 'Client',
    searchPreview:
      'Search for Atlas to show all four categories. Select a state to inspect loading, errors or an empty list.',
    singleBusinessPreview:
      'One real component is displayed. Controls present its states without duplicate identifiers or dialogs.',
    copyNoticePreview:
      'The button copies a link with AnchorCopy. The existing global notice shows the message, then disappears after 2.4 seconds.',
    copyNoticeMessage: 'Example link copied',
    diagram: 'Diagram',
    flowchart: 'Flowchart',
    sequence: 'Sequence',
    diagramSafety:
      'Only these predefined diagrams are rendered. Mermaid keeps its strict mode and deferred loading.',
    diagrams: {
      flowchart:
        'flowchart LR\n  accTitle: Local flow\n  accDescr: A preview followed by local validation.\n  A[Preview] --> B[Local validation]',
      sequence:
        'sequenceDiagram\n  accTitle: Local sequence\n  accDescr: A request and response between two fictitious actors.\n  participant A as Preview\n  participant B as Local data\n  A->>B: Read\n  B-->>A: Example',
    },
    samePreview:
      'The preview above shows this variant. Resize the window to inspect its responsive layout.',
    resultCount: { one: '{count} result', other: '{count} results' },
    groups: {
      actions: 'Actions',
      feedback: 'Messages and states',
      fields: 'Fields and filters',
      data: 'Lists and data',
      navigation: 'Navigation and dialogs',
      presentation: 'Website presentation',
      compositions: 'Compositions',
    },
  },
} as const;
