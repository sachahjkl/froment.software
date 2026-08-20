import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DataTable } from './data-table';

@Component({
  imports: [DataTable],
  template: '<div appDataTable><table><tbody><tr><td>Value</td></tr></tbody></table></div>',
})
class TestHost {}

describe('DataTable', () => {
  it('applies the shared table class', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();

    const table: HTMLElement | null = fixture.nativeElement.querySelector('[appDataTable]');
    expect(table?.classList.contains('data-table')).toBe(true);
    expect(table?.tabIndex).toBe(0);
    expect(table?.getAttribute('role')).toBe('region');
    expect(table?.getAttribute('aria-label')).toMatch(/Tableau|table/i);
  });
});
