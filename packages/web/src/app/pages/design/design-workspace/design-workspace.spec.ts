import { TestBed } from '@angular/core/testing';
import { FormField } from '@angular/forms/signals';
import { By } from '@angular/platform-browser';
import {
  NavigationCancel,
  NavigationCancellationCode,
  provideRouter,
  Router,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '@app/app.routes';
import { I18nService } from '@app/i18n.service';
import { Confirmation } from '@shared/confirmation/confirmation';
import { installScrollIntoView } from '@shared/filter-choice/filter-choice.spec-helper';
import { serializeCsv } from '@shared/table-export/csv';
import { TableExport } from '@shared/table-export/table-export';
import { DesignWorkspace } from './design-workspace';

describe('DesignWorkspace', () => {
  let scrolling: ReturnType<typeof installScrollIntoView>;
  beforeEach(() => {
    scrolling = installScrollIntoView();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    scrolling.restore();
  });
  async function setup() {
    const confirm = { request: vi.fn().mockResolvedValue(false) };
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Confirmation, useValue: confirm }],
    });
    const fixture = TestBed.createComponent(DesignWorkspace);
    await fixture.whenStable();
    TestBed.inject(I18nService).setLanguage('fr');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    function button(label: string): HTMLButtonElement {
      const found = [...root.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === label,
      );
      if (!found) throw new Error(`Button not found: ${label}`);
      return found;
    }
    async function input(selector: string, value: string) {
      const element = root.querySelector<HTMLInputElement>(selector)!;
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      await fixture.whenStable();
    }
    async function select(element: HTMLSelectElement, value: string) {
      element.value = value;
      // Un choix natif émet input avant change. Signal Forms lit la valeur sur input.
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      await fixture.whenStable();
    }
    async function scenario(value: string) {
      await select(root.querySelector<HTMLSelectElement>('#workspace-scenario')!, value);
    }
    async function status(value: string) {
      root.querySelector<HTMLButtonElement>('app-filter-menu > button')!.click();
      await fixture.whenStable();
      const dialog = document.querySelector('[role="dialog"]')!;
      const category = dialog.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
      expect(document.activeElement).toBe(category);
      category.click();
      await fixture.whenStable();
      const control = dialog.querySelector<HTMLInputElement>('#workspace-status input')!;
      expect(document.activeElement).toBe(control);
      const label =
        value === 'draft'
          ? 'Brouillon'
          : value === 'ready'
            ? 'Prêt dans la démonstration'
            : 'Tous les états';
      const option = [...dialog.querySelectorAll<HTMLElement>('[role="option"]')].find(
        (item) => item.querySelector('.option-label')?.textContent?.trim() === label,
      )!;
      option.click();
      await fixture.whenStable();
      expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
      dialog.querySelector<HTMLButtonElement>('button.close')!.click();
      await fixture.whenStable();
    }
    function exporter() {
      return fixture.debugElement.query(By.directive(TableExport)).injector.get(TableExport);
    }
    return { fixture, root, confirm, button, input, scenario, status, exporter };
  }

  it('paginates actual local matches, filters with Fuse and resets page selection', async () => {
    const { fixture, root, button, input } = await setup();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(root.querySelector('app-result-navigation')?.textContent).toContain(
      'Affichés 1–3 sur 6',
    );
    root.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLElement>('app-bulk-selection')?.hidden).toBe(false);
    expect(root.querySelector('app-bulk-selection')?.textContent).toContain(
      'Sélectionnés sur cette page : 3',
    );
    button('Page suivante').click();
    await fixture.whenStable();
    expect(root.querySelector('app-result-navigation')?.textContent).toContain(
      'Affichés 4–6 sur 6',
    );
    expect(root.querySelector<HTMLElement>('app-bulk-selection')?.hidden).toBe(true);
    await input('#workspace-search input', 'atls');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('tbody')?.textContent).toContain('Atlas');
    expect(root.querySelector('app-result-navigation')?.textContent).toContain(
      'Affichés 1–1 sur 1',
    );
    root.querySelector<HTMLButtonElement>('button[appFilterChip]')!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(document.activeElement).toBe(root.querySelector('#workspace-search input'));
  });

  it('uses the toolbar slots and one list workspace for spacing', async () => {
    const { root } = await setup();
    const workspace = root.querySelector<HTMLElement>('[appListWorkspace]')!;
    expect(workspace.style.display).toBe('grid');
    expect(workspace.style.gap).toBe('var(--space-4)');
    expect(workspace.querySelector(':scope > app-list-toolbar')).not.toBeNull();
    expect(workspace.querySelector(':scope > [appDataTable]')).not.toBeNull();
    expect(workspace.querySelector('.chips')).toBeNull();
    expect(root.querySelector('app-list-toolbar .search app-list-search')).not.toBeNull();
    expect(root.querySelector('app-list-toolbar .filters app-filter-menu')).not.toBeNull();
    expect(root.querySelector('app-list-toolbar .actions app-table-export')).not.toBeNull();
    expect(root.querySelector('app-list-toolbar .summary [role="status"]')).not.toBeNull();
  });

  it('updates the parent search field on bubbling input and keeps short-query fuzzy matches', async () => {
    const { fixture, root, input, exporter } = await setup();
    const control = root.querySelector<HTMLInputElement>('#workspace-search input')!;
    const field = fixture.debugElement.query(By.css('#workspace-search')).injector.get(FormField);
    expect(field.state().value()).toBe('');
    control.focus();
    await input('#workspace-search input', 'atl');
    expect(document.activeElement).toBe(control);
    expect(control.value).toBe('atl');
    expect(field.state().value()).toBe('atl');
    expect(root.querySelector('[appFilterChip]')?.textContent).toContain('Recherche : atl');
    // Le seuil 0,35 autorise une erreur sur trois caractères, dont le t absent de « al ».
    expect(
      exporter()
        .rows()
        .map((row) => row[1]),
    ).toEqual(['Atlas', 'Boréal', 'Cobalt']);
    expect(root.querySelector<HTMLElement>('app-bulk-selection')?.hidden).toBe(true);
    expect(exporter().label()).toBe('Exporter les résultats filtrés (CSV)');

    await input('#workspace-search input', 'atls');
    expect(field.state().value()).toBe('atls');
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(exporter().rows()).toEqual([['DEMO-1', 'Atlas', 'contact1@example.com', 'Brouillon']]);
  });

  it('exports filtered rows across pages in sort order and limits an active selection', async () => {
    const { fixture, root, input, status, exporter } = await setup();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(exporter().rows()).toHaveLength(6);
    expect(exporter().filename()).toBe('design-workspace.csv');
    await input('#workspace-search input', 'atls');
    expect(exporter().rows()).toEqual([['DEMO-1', 'Atlas', 'contact1@example.com', 'Brouillon']]);
    root.querySelector<HTMLButtonElement>('[appFilterChip]')!.click();
    await fixture.whenStable();
    await status('draft');
    expect(root.querySelector('app-filter-menu button')?.getAttribute('aria-label')).toBe(
      'Filtres (1)',
    );
    root.querySelector<HTMLButtonElement>('[appTableSort]')!.click();
    await fixture.whenStable();
    expect(
      exporter()
        .rows()
        .map((row) => row[1]),
    ).toEqual(['Équinoxe', 'Cobalt', 'Atlas']);
    const selections = root.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
    selections[2].click();
    await fixture.whenStable();
    selections[0].click();
    await fixture.whenStable();
    expect(exporter().label()).toBe('Exporter la sélection (CSV)');
    expect(serializeCsv(exporter().columns(), exporter().rows())).toBe(
      '\uFEFF"Référence","Nom de la prestation","Courriel du contact","État"\r\n' +
        '"DEMO-5","Équinoxe","contact5@example.com","Brouillon"\r\n' +
        '"DEMO-1","Atlas","contact1@example.com","Brouillon"\r\n',
    );
    root.querySelector<HTMLButtonElement>('[appFilterChip]')!.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('app-filter-menu button'));
    expect(exporter().rows()).toHaveLength(6);
    expect(exporter().label()).toBe('Exporter les résultats filtrés (CSV)');
  });

  it('neutralizes harmless formula fixtures when exporting local form values', async () => {
    const { fixture, button, input, exporter } = await setup();
    for (const name of ['=1+1', '+1', '-1', '@SUM(1,1)']) {
      button('Nouvelle prestation').click();
      await fixture.whenStable();
      await input('#workspace-name', name);
      await input('#workspace-contact', 'csv@example.com');
      await input('#workspace-line-name-0', 'CSV');
      button('Appliquer à la démonstration').click();
      await fixture.whenStable();
      button('Retour à la liste').click();
      await fixture.whenStable();
      const row = exporter()
        .rows()
        .find((item) => item[1] === name);
      expect(row).toBeDefined();
      const csv = serializeCsv(exporter().columns(), [row!]);
      expect(csv).toContain(`,"'${name}","csv@example.com",`);
      expect(csv).not.toContain(`,"${name}","csv@example.com",`);
    }
  });

  it('explains unavailable exports for loading and empty states', async () => {
    const { fixture, root, scenario, exporter } = await setup();
    await scenario('loading');
    expect(exporter().pending()).toBe(true);
    expect(root.querySelector('app-table-export button')?.getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(root.querySelector('app-table-export [popover]')?.textContent).toContain(
      'Attendez la fin du chargement',
    );
    for (const state of ['error', 'empty', 'noMatch']) {
      await scenario(state);
      expect(exporter().rows()).toEqual([]);
      expect(exporter().pending()).toBe(false);
      expect(root.querySelector('app-table-export [popover]')?.textContent).toContain(
        'Aucun résultat à exporter',
      );
    }
    await scenario('ready');
    await fixture.whenStable();
    expect(root.querySelector('app-table-export button')?.getAttribute('aria-disabled')).toBe(
      'false',
    );
  });

  it('exposes all simulated states and lets the user recover to real local rows', async () => {
    const { fixture, root, button, scenario } = await setup();
    await scenario('loading');
    expect(root.textContent).toContain('Chargement simulé');
    expect(root.querySelector('table')).toBeNull();
    await scenario('error');
    expect(root.textContent).toContain('Erreur de chargement simulée');
    button('Afficher les données locales').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    await scenario('empty');
    expect(root.textContent).toContain('Aucune prestation dans cet exemple');
    await scenario('noMatch');
    expect(root.textContent).toContain('Aucune prestation ne correspond');
    button('Effacer les filtres').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('focuses the first invalid field and applies only valid local values', async () => {
    const { fixture, root, button, input } = await setup();
    button('Nouvelle prestation').click();
    await fixture.whenStable();
    expect(root.querySelector('form')).not.toBeNull();
    const save = button('Appliquer à la démonstration');
    expect(save.disabled).toBe(false);
    save.click();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('workspace-name');
    expect(root.querySelector('#workspace-name')?.getAttribute('aria-describedby')).toBe(
      'workspace-name-error',
    );
    await input('#workspace-name', 'Nova');
    await input('#workspace-contact', 'contact@example.com');
    await input('#workspace-line-name-0', 'Angular');
    await input('#workspace-quantity-0', '1,500');
    await input('#workspace-price-0', '19.99');
    expect(root.querySelector('.sum')?.textContent).toContain('29,99 €');
    expect(root.querySelector('#workspace-summary')?.textContent).toContain('non enregistré');
    save.click();
    await fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('.detail-values')?.textContent).toContain('Nova');
    expect(root.querySelector('.feedback')?.textContent).toContain(
      'Aucune donnée n’a été transmise',
    );
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
  });

  it('protects edited values on switches and beforeunload', async () => {
    const { fixture, root, confirm, button, input } = await setup();
    button('Nouvelle prestation').click();
    await fixture.whenStable();
    await input('#workspace-name', 'Unsaved example');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    button('Annuler les modifications').click();
    await fixture.whenStable();
    expect(confirm.request).toHaveBeenCalledOnce();
    expect(root.querySelector('form')).not.toBeNull();
    expect((root.querySelector('#workspace-name') as HTMLInputElement).value).toBe(
      'Unsaved example',
    );
    confirm.request.mockResolvedValue(true);
    button('Annuler les modifications').click();
    await fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
  });

  it('adds and removes lines with focus and recalculates the unsaved summary', async () => {
    const { fixture, root, button, input } = await setup();
    button('Atlas').click();
    await fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelectorAll('app-event-history li')).toHaveLength(1);
    button('Modifier').click();
    await fixture.whenStable();
    expect(root.querySelector('.sum')?.textContent).toContain('266,00 €');
    button('Ajouter une ligne').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.line-editor')).toHaveLength(3);
    expect(document.activeElement?.id).toBe('workspace-line-name-2');
    await input('#workspace-price-2', '4,25');
    expect(root.querySelector('.sum')?.textContent).toContain('270,25 €');
    root.querySelector<HTMLButtonElement>('[aria-label="Retirer la ligne 3"]')!.click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.line-editor')).toHaveLength(2);
    expect(document.activeElement?.id).toBe('workspace-line-name-1');
    expect(root.querySelector('.sum')?.textContent).toContain('266,00 €');
  });

  it('executes real local bulk actions and confirms removal', async () => {
    const { fixture, root, confirm, button } = await setup();
    root.querySelector<HTMLInputElement>('thead input')!.click();
    await fixture.whenStable();
    button('Marquer la sélection comme prête').click();
    await fixture.whenStable();
    const statuses = [...root.querySelectorAll('tbody [appBadge]')].map((badge) =>
      badge.textContent?.trim(),
    );
    expect(statuses).toEqual(Array(3).fill('Prêt dans la démonstration'));
    root.querySelector<HTMLInputElement>('thead input')!.click();
    await fixture.whenStable();
    expect(button('Marquer la sélection comme prête').disabled).toBe(true);
    button('Supprimer la sélection').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(3);
    confirm.request.mockResolvedValue(true);
    button('Supprimer la sélection').click();
    await fixture.whenStable();
    expect(root.querySelector('app-result-navigation')?.textContent).toContain(
      'Affichés 1–3 sur 3',
    );
    expect(root.querySelector('tbody')?.textContent).not.toContain('Atlas');
  });

  it('renders English copy without requesting data services', async () => {
    const { fixture, root } = await setup();
    TestBed.inject(I18nService).setLanguage('en');
    await fixture.whenStable();
    expect(root.textContent).toContain('A complete workspace');
    expect(root.textContent).toContain('New service');
    expect(root.querySelector('app-result-navigation')?.textContent).toContain('Showing 1–3 of 6');
  });
});

describe('DesignWorkspace child-route guard', () => {
  async function setup() {
    const confirm = { request: vi.fn().mockResolvedValue(false) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes.filter((route) => route.path === 'design' || route.path === 'legal'),
          withComponentInputBinding(),
        ),
        { provide: Confirmation, useValue: confirm },
      ],
    });
    const harness = await RouterTestingHarness.create('/design/workflows');
    TestBed.inject(I18nService).setLanguage('fr');
    await harness.fixture.whenStable();
    const child = harness.routeDebugElement!.query(By.directive(DesignWorkspace));
    const workspace = child.injector.get(DesignWorkspace);
    const guard = vi.spyOn(workspace, 'canDeactivate');
    const root: HTMLElement = child.nativeElement;
    const parent = harness.routeDebugElement!.componentInstance;
    const router = TestBed.inject(Router);
    const cancellations: NavigationCancel[] = [];
    const events = router.events.subscribe((event) => {
      if (event instanceof NavigationCancel) cancellations.push(event);
    });

    async function openEditor() {
      root.querySelector<HTMLButtonElement>('app-split-action > button')!.click();
      await harness.fixture.whenStable();
    }
    async function fill(selector: string, value: string) {
      const field = root.querySelector<HTMLInputElement>(selector)!;
      field.value = value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      await harness.fixture.whenStable();
    }
    function unloadPrevented() {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }
    return {
      harness,
      root,
      parent,
      router,
      guard,
      confirm,
      cancellations,
      events,
      openEditor,
      fill,
      unloadPrevented,
    };
  }

  for (const destination of ['/design/button', '/legal']) {
    it(`protects the lazy child when navigating to ${destination}`, async () => {
      const context = await setup();
      const {
        harness,
        root,
        parent,
        router,
        guard,
        confirm,
        cancellations,
        events,
        openEditor,
        fill,
        unloadPrevented,
      } = context;
      try {
        await openEditor();
        expect(unloadPrevented()).toBe(false);
        await fill('#workspace-name', 'Draft protected by the child');
        expect(unloadPrevented()).toBe(true);

        await harness.navigateByUrl(destination);
        await harness.fixture.whenStable();
        expect(guard).toHaveBeenCalledOnce();
        expect(confirm.request).toHaveBeenCalledOnce();
        expect(cancellations).toHaveLength(1);
        expect(cancellations[0].code).toBe(NavigationCancellationCode.GuardRejected);
        expect(router.url).toBe('/design/workflows');
        expect(harness.routeDebugElement!.componentInstance).toBe(parent);
        expect(root.querySelector<HTMLInputElement>('#workspace-name')!.value).toBe(
          'Draft protected by the child',
        );
        expect(unloadPrevented()).toBe(true);

        confirm.request.mockResolvedValue(true);
        await harness.navigateByUrl(destination);
        await harness.fixture.whenStable();
        expect(guard).toHaveBeenCalledTimes(2);
        expect(confirm.request).toHaveBeenCalledTimes(2);
        expect(router.url).toBe(destination);
        expect(harness.routeNativeElement!.querySelector('app-design-workspace')).toBeNull();
        expect(unloadPrevented()).toBe(false);
        if (destination.startsWith('/design/')) {
          expect(harness.routeDebugElement!.componentInstance).toBe(parent);
          expect(
            harness.routeNativeElement!.querySelector('[data-component="button"]'),
          ).not.toBeNull();
        } else {
          expect(harness.routeDebugElement!.componentInstance).not.toBe(parent);
          expect(harness.routeNativeElement!.tagName.toLowerCase()).toBe('app-policy-page');
        }
      } finally {
        events.unsubscribe();
      }
    });

    it(`leaves an unchanged form for ${destination} without confirmation`, async () => {
      const { harness, router, guard, confirm, events, openEditor, fill, unloadPrevented } =
        await setup();
      try {
        await openEditor();
        await fill('#workspace-name', 'Temporary change');
        await fill('#workspace-name', '');
        expect(unloadPrevented()).toBe(false);
        await harness.navigateByUrl(destination);
        await harness.fixture.whenStable();
        expect(router.url).toBe(destination);
        expect(guard).toHaveBeenCalledOnce();
        expect(confirm.request).not.toHaveBeenCalled();
        expect(unloadPrevented()).toBe(false);
      } finally {
        events.unsubscribe();
      }
    });
  }
});
