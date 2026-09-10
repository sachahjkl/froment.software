import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import { ListSearch } from './list-search';

@Component({
  imports: [ListSearch],
  template: '<app-list-search label="Rechercher des clients" [(value)]="query" />',
})
class SearchExample {
  readonly query = signal('Émile');
}

@Component({
  imports: [ListSearch, FormField],
  template: '<app-list-search label="Rechercher des clients" [formField]="search" />',
})
class SearchFormExample {
  readonly query = signal('');
  readonly unavailable = signal(false);
  readonly search = form(this.query, (path) => disabled(path, () => this.unavailable()));
}

describe('ListSearch', () => {
  it('labels the search and synchronizes its value in both directions', async () => {
    const fixture = TestBed.createComponent(SearchExample);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('search');
    expect(input.labels?.[0]?.textContent).toContain('Rechercher des clients');
    expect(input.labels?.[0]?.querySelector('.sr-only')).not.toBeNull();
    expect(input.placeholder).toBe('Rechercher des clients');
    expect(input.value).toBe('Émile');
    input.value = 'Zoé';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.query()).toBe('Zoé');
    fixture.componentInstance.query.set('');
    await fixture.whenStable();
    expect(input.value).toBe('');
  });

  it('connects the parent Signal Form value, touch state, and disabled state', async () => {
    const fixture = TestBed.createComponent(SearchFormExample);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Facture';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.query()).toBe('Facture');
    expect(fixture.componentInstance.search().touched()).toBe(true);
    fixture.componentInstance.unavailable.set(true);
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
    fixture.componentInstance.unavailable.set(false);
    await fixture.whenStable();
    expect(input.disabled).toBe(false);
  });

  it('focuses the native search control', async () => {
    const fixture = TestBed.createComponent(ListSearch);
    fixture.componentRef.setInput('label', 'Search');
    fixture.componentRef.setInput('placeholder', 'Name or reference');
    await fixture.whenStable();
    fixture.componentInstance.focus();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('input'));
    expect(fixture.nativeElement.querySelector('input').placeholder).toBe('Name or reference');
  });
});
