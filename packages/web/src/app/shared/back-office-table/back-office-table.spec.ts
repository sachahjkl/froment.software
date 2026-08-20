import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { BackOfficeTable } from './back-office-table';

@Component({
  imports: [BackOfficeTable],
  template: '<div appBackOfficeTable><table><tbody><tr><td>Value</td></tr></tbody></table></div>',
})
class TestHost {}

describe('BackOfficeTable', () => {
  it('applies the shared table class', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();

    const table: HTMLElement | null = fixture.nativeElement.querySelector('[appBackOfficeTable]');
    expect(table?.classList.contains('back-office-table')).toBe(true);
  });
});
