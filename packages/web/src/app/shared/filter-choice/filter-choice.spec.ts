import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { vi } from 'vitest';
import { FilterChoice } from './filter-choice';
import { installScrollIntoView, pressKey } from './filter-choice.spec-helper';

@Component({
  imports: [FilterChoice, FormField],
  template: `
    <app-filter-choice
      label="État"
      emptyLabel="Aucune option"
      [options]="options"
      [formField]="status"
    />
  `,
})
class ChoiceFormExample {
  readonly unavailable = signal(false);
  readonly status = form(signal('draft'), (path) => disabled(path, () => this.unavailable()));
  readonly options = [
    { value: 'draft', label: 'Brouillon' },
    { value: 'sent', label: 'Envoyé' },
  ];
}

describe('FilterChoice', () => {
  let fixture: ComponentFixture<FilterChoice>;
  let input: HTMLInputElement;
  let scrolling: ReturnType<typeof installScrollIntoView>;
  const committed = vi.fn();

  beforeEach(async () => {
    scrolling = installScrollIntoView();
    committed.mockReset();
    fixture = TestBed.createComponent(FilterChoice);
    fixture.componentRef.setInput('label', 'Rechercher un état');
    fixture.componentRef.setInput('emptyLabel', 'Aucune option ne correspond.');
    fixture.componentRef.setInput('options', [
      { value: '', label: 'Tous', count: 9 },
      { value: 'draft', label: 'Brouillon', count: 2 },
      { value: 'sent', label: 'Envoyé', count: 7 },
    ]);
    fixture.componentRef.setInput('value', 'sent');
    fixture.componentInstance.committed.subscribe(committed);
    await fixture.whenStable();
    input = fixture.nativeElement.querySelector('input');
  });

  afterEach(() => {
    fixture.destroy();
    scrolling.restore();
  });

  it('renders an inline Aria combobox with an explicit selected option and no overlay', () => {
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-label')).toBe('Rechercher un état');
    expect(input.placeholder).toBe('Rechercher un état');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('h2')).toBeNull();
    const listbox = fixture.nativeElement.querySelector('[role="listbox"]') as HTMLElement;
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(listbox.querySelector('[aria-selected="true"]')?.textContent).toContain('Envoyé');
    expect(listbox.querySelector('[aria-selected="true"] .check')).not.toBeNull();
    expect(listbox.querySelector('[aria-selected="true"] .count')?.textContent).toBe('7');
    expect(document.querySelector('.cdk-overlay-pane')).toBeNull();
    expect(committed).not.toHaveBeenCalled();
  });

  it('filters with Fuse without selecting the first match or changing the committed value', async () => {
    input.value = 'brouilon';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('[role="option"]').textContent).toContain(
      'Brouillon',
    );
    expect(fixture.componentInstance.value()).toBe('sent');
    expect(committed).not.toHaveBeenCalled();
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-selected="true"]').textContent).toContain(
      'Envoyé',
    );
    expect(committed).not.toHaveBeenCalled();
  });

  it('uses Home, End, and arrows without committing until Enter', async () => {
    input.focus();
    pressKey(input, 'Home');
    await fixture.whenStable();
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent,
    ).toContain('Tous');
    pressKey(input, 'End');
    await fixture.whenStable();
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent,
    ).toContain('Envoyé');
    pressKey(input, 'ArrowUp');
    await fixture.whenStable();
    expect(
      document.getElementById(input.getAttribute('aria-activedescendant')!)?.textContent,
    ).toContain('Brouillon');
    expect(fixture.componentInstance.value()).toBe('sent');
    expect(committed).not.toHaveBeenCalled();
    pressKey(input, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('draft');
    expect(committed).toHaveBeenCalledExactlyOnceWith('draft');
    expect(scrolling.scroll).toHaveBeenCalled();
  });

  it('commits an exact clicked option, including the empty value used for all results', async () => {
    const first = fixture.nativeElement.querySelector('[role="option"]') as HTMLElement;
    first.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('');
    expect(committed).toHaveBeenCalledExactlyOnceWith('');
    expect(document.activeElement).toBe(input);
  });

  it('keeps the selected option selected when it is confirmed again', async () => {
    const selected = fixture.nativeElement.querySelector('[aria-selected="true"]') as HTMLElement;
    selected.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('sent');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(committed).toHaveBeenCalledExactlyOnceWith('sent');
  });

  it('announces zero matches and never commits arbitrary search text', async () => {
    input.value = 'zzzzzzzzzzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toBe(
      'Aucune option ne correspond.',
    );
    pressKey(input, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('sent');
    expect(committed).not.toHaveBeenCalled();
  });

  it('handles an empty option collection and disabled controls without a commit', async () => {
    fixture.componentRef.setInput('options', []);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]')).toHaveLength(0);
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
    pressKey(input, 'Enter');
    await fixture.whenStable();
    expect(committed).not.toHaveBeenCalled();
  });

  it('does not commit when Escape is pressed', async () => {
    input.focus();
    pressKey(input, 'ArrowUp');
    await fixture.whenStable();
    pressKey(input, 'Escape');
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('sent');
    expect(committed).not.toHaveBeenCalled();
  });

  it('accepts an external value update without emitting a commit', async () => {
    fixture.componentRef.setInput('value', 'draft');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-selected="true"]').textContent).toContain(
      'Brouillon',
    );
    expect(committed).not.toHaveBeenCalled();
  });

  it('connects a parent Signal Form value, touch state, and disabled state', async () => {
    const formFixture = TestBed.createComponent(ChoiceFormExample);
    await formFixture.whenStable();
    const options = formFixture.nativeElement.querySelectorAll('[role="option"]');
    options[1].click();
    await formFixture.whenStable();
    expect(formFixture.componentInstance.status().value()).toBe('sent');
    expect(formFixture.componentInstance.status().touched()).toBe(true);
    formFixture.componentInstance.unavailable.set(true);
    await formFixture.whenStable();
    expect(formFixture.nativeElement.querySelector('input').disabled).toBe(true);
    formFixture.destroy();
  });
});
