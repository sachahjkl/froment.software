import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DesignComponent } from './design.component';

describe('DesignComponent', () => {
  it('starts with the catalog tabs and keeps the content demo in its panel', async () => {
    const fixture = TestBed.createComponent(DesignComponent);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const header = root.querySelector('.proposal > header');
    const tabs = root.querySelector('.proposal > app-tabs');
    expect(header?.nextElementSibling).toBe(tabs);
    expect(tabs?.querySelectorAll('[role="tab"]')).toHaveLength(7);
    expect(root.querySelector('#design-demo-panel')?.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('#design-actions-panel')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('#design-demo-panel #work')).not.toBeNull();

    root.querySelector<HTMLButtonElement>('#design-documents-tab')?.click();
    await fixture.whenStable();
    expect(root.querySelector('#design-demo-panel')?.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('#design-documents-panel app-design-documents')).not.toBeNull();
  });
});
