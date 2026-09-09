import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it } from 'vitest';

import { DesignComponent } from './design.component';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';

describe('DesignComponent', () => {
  it('starts with the catalog tabs and keeps the content demo in its panel', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: '',
            component: DesignComponent,
            children: [
              { path: 'demo', component: TabPanelOutlet, data: { panel: 'demo' } },
              { path: 'documents', component: TabPanelOutlet, data: { panel: 'documents' } },
              { path: 'data', component: TabPanelOutlet, data: { panel: 'data' } },
            ],
          },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/demo');
    const fixture = harness.fixture;
    const root: HTMLElement = fixture.nativeElement;
    const header = root.querySelector('.proposal > header');
    const tabs = root.querySelector('.proposal > app-tabs');
    expect(header?.nextElementSibling).toBe(tabs);
    expect(tabs?.querySelectorAll('a')).toHaveLength(7);
    expect(root.querySelector('#design-demo-panel')).not.toBeNull();
    expect(root.querySelector('#design-actions-panel')).toBeNull();
    expect(root.querySelector('#design-demo-panel #work')).not.toBeNull();

    root.querySelector<HTMLAnchorElement>('#design-documents-tab')?.click();
    await fixture.whenStable();
    expect(root.querySelector('#design-demo-panel')).toBeNull();
    expect(root.querySelector('#design-documents-panel app-design-documents')).not.toBeNull();
    root.querySelector<HTMLAnchorElement>('#design-data-tab')!.click();
    await fixture.whenStable();
    const search = root.querySelector<HTMLInputElement>('app-list-toolbar input')!;
    search.value = 'Angular';
    search.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(root.querySelectorAll('#design-data-panel tbody tr')).toHaveLength(1);
  });
});
