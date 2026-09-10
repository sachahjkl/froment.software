import { Dialog } from '@angular/cdk/dialog';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { form, FormField } from '@angular/forms/signals';
import { vi } from 'vitest';
import { FilterChoice } from '@shared/filter-choice/filter-choice';
import { installScrollIntoView, pressKey } from '@shared/filter-choice/filter-choice.spec-helper';
import { FilterMenu, FilterPanel } from './filter-menu';

@Component({
  imports: [FilterMenu, FilterPanel, FilterChoice, FormField],
  template: `
    <app-filter-menu
      #menu
      label="Filtres"
      closeLabel="Fermer les filtres"
      backLabel="Revenir aux catégories"
      [activeCount]="count()"
      [disabled]="disabled()"
    >
      <ng-template appFilterPanel label="État" [summary]="status()">
        <app-filter-choice
          label="Rechercher un état"
          emptyLabel="Aucune option"
          [options]="options"
          [(value)]="status"
          (committed)="menu.close()"
        />
      </ng-template>
      <ng-template appFilterPanel label="Période" summary="Septembre">
        <label>Depuis<input type="date" [formField]="date" /></label>
      </ng-template>
      <ng-template appFilterPanel label="Client" summary="Tous">
        <label>Client<input [formField]="client" /></label>
      </ng-template>
    </app-filter-menu>
  `,
})
class FiltersExample {
  readonly count = signal(1);
  readonly disabled = signal(false);
  readonly status = signal('sent');
  readonly date = form(signal('2026-09-01'));
  readonly client = form(signal(''));
  readonly options = [
    { value: '', label: 'Tous' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'sent', label: 'Envoyé' },
  ];
}

describe('FilterMenu', () => {
  let fixture: ComponentFixture<FiltersExample>;
  let trigger: HTMLButtonElement;
  let scrolling: ReturnType<typeof installScrollIntoView>;

  beforeEach(async () => {
    scrolling = installScrollIntoView();
    fixture = TestBed.createComponent(FiltersExample);
    await fixture.whenStable();
    trigger = fixture.nativeElement.querySelector('button');
  });

  afterEach(() => {
    fixture.destroy();
    scrolling.restore();
  });

  it('shows only compact category rows inside one anchored dialog', async () => {
    expect(trigger.getAttribute('aria-label')).toBe('Filtres (1)');
    trigger.click();
    await fixture.whenStable();
    const dialog = document.querySelector('[role="dialog"]')!;
    const heading = document.getElementById(dialog.getAttribute('aria-labelledby')!)!;
    expect(heading.textContent).toBe('Filtres');
    expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    expect(dialog.querySelector('[role="menuitem"]')?.textContent).toContain('sent');
    expect(dialog.querySelector('input')).toBeNull();
    expect(dialog.querySelector('details')).toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector('[role="menuitem"]'));
    expect(document.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1);
    expect(document.querySelector<HTMLElement>('.cdk-overlay-pane')?.style.width).toBe('20rem');
    expect(trigger.getAttribute('aria-controls')).toBe(dialog.id);
  });

  it('uses CDK arrows, Home, End, and typeahead to navigate the categories', async () => {
    trigger.click();
    await fixture.whenStable();
    const categories = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    pressKey(categories[0]!, 'ArrowDown', 40);
    expect(document.activeElement).toBe(categories[1]);
    pressKey(categories[1]!, 'End', 35);
    expect(document.activeElement).toBe(categories[2]);
    pressKey(categories[2]!, 'Home', 36);
    expect(document.activeElement).toBe(categories[0]);
    pressKey(categories[0]!, 'p', 80);
    await vi.waitFor(() => expect(document.activeElement).toBe(categories[1]));
    pressKey(categories[1]!, 'Enter', 13);
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"] h2')?.textContent).toBe('Période');
    expect(document.activeElement).toBe(document.querySelector('input[type="date"]'));
  });

  it('replaces categories with a panel and restores the category focus on Back', async () => {
    trigger.click();
    await fixture.whenStable();
    const dialog = document.querySelector('[role="dialog"]')!;
    const id = dialog.id;
    dialog.querySelectorAll<HTMLElement>('[role="menuitem"]')[1]!.click();
    await fixture.whenStable();
    const date = document.querySelector<HTMLInputElement>('input[type="date"]')!;
    expect(document.activeElement).toBe(date);
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')?.id).toBe(id);
    expect(dialog.querySelector('[role="menu"]')).toBeNull();
    date.value = '2026-09-10';
    date.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    dialog.querySelector<HTMLButtonElement>('.back')!.click();
    await fixture.whenStable();
    expect(dialog.querySelector('input')).toBeNull();
    expect(document.activeElement).toBe(dialog.querySelectorAll('[role="menuitem"]')[1]);
    expect(fixture.componentInstance.date().value()).toBe('2026-09-10');
    const categories = dialog.querySelectorAll<HTMLElement>('[role="menuitem"]');
    pressKey(categories[1]!, 'ArrowDown', 40);
    expect(document.activeElement).toBe(categories[2]);
  });

  it('initializes CDK navigation again after the dialog is reopened', async () => {
    trigger.click();
    await fixture.whenStable();
    const categories = document.querySelectorAll<HTMLElement>('[role="menuitem"]');
    pressKey(categories[0]!, 'ArrowDown', 40);
    expect(document.activeElement).toBe(categories[1]);
    pressKey(categories[1]!, 'Escape', 27);
    await fixture.whenStable();
    trigger.click();
    await fixture.whenStable();
    const reopenedCategories = document.querySelectorAll<HTMLElement>('[role="menuitem"]');
    expect(document.activeElement).toBe(reopenedCategories[0]);
    pressKey(reopenedCategories[0]!, 'ArrowDown', 40);
    expect(document.activeElement).toBe(reopenedCategories[1]);
  });

  it('keeps the Aria choice inline and closes after an explicit commit', async () => {
    trigger.click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await fixture.whenStable();
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(document.activeElement).toBe(input);
    expect(document.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1);
    expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    pressKey(input, 'Home');
    await fixture.whenStable();
    expect(fixture.componentInstance.status()).toBe('sent');
    pressKey(input, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.status()).toBe('');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes with Escape from the always-expanded combobox and restores trigger focus', async () => {
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('[role="menuitem"]')!.click();
    await fixture.whenStable();
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!;
    input.value = 'Brouillon';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    pressKey(input, 'Escape', 27);
    await fixture.whenStable();
    expect(fixture.componentInstance.status()).toBe('sent');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the root menu with Escape or a backdrop click', async () => {
    trigger.click();
    await fixture.whenStable();
    pressKey(document.querySelector<HTMLElement>('[role="menuitem"]')!, 'Escape', 27);
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    trigger.click();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('blocks disabled triggers and removes the dialog on destruction', async () => {
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();
    trigger.click();
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(0);
    fixture.componentInstance.disabled.set(false);
    fixture.componentInstance.count.set(0);
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-label')).toBe('Filtres');
    trigger.click();
    await fixture.whenStable();
    fixture.destroy();
    expect(TestBed.inject(Dialog).openDialogs).toHaveLength(0);
  });
});
