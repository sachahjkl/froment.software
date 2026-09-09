import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Drawer } from './drawer';

@Component({
  imports: [Drawer],
  template: `<button id="trigger" (click)="open.set(true)">Open</button>
    <app-drawer [open]="open()" label="Navigation" closeLabel="Close" (closed)="open.set(false)">
      <a href="/example">Example</a>
    </app-drawer>`,
})
class DrawerExample {
  readonly open = signal(false);
}

describe('Drawer', () => {
  it('opens a named dialog and closes through its control or backdrop', async () => {
    const fixture = TestBed.createComponent(DrawerExample);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('#trigger').click();
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(
      'Navigation',
    );
    expect(document.querySelector('[role="dialog"] a')?.textContent).toBe('Example');
    document.querySelector<HTMLButtonElement>('[data-drawer-close]')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('removes the dialog when its owner is destroyed', async () => {
    const fixture = TestBed.createComponent(DrawerExample);
    fixture.componentInstance.open.set(true);
    await fixture.whenStable();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    fixture.destroy();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.documentElement.classList.contains('cdk-global-scrollblock')).toBe(false);
  });
});
