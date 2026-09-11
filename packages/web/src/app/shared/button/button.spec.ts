import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Button, type ButtonVariant } from './button';

@Component({
  imports: [Button],
  template: `
    <button appButton type="button" [variant]="variant()" [disabled]="disabled()">Action</button>
    <a appLinkButton href="#target" [variant]="variant()">Destination</a>
  `,
})
class TestHost {
  readonly variant = signal<ButtonVariant>('ghost');
  readonly disabled = signal(false);
}

describe('Button', () => {
  it('exposes ghost and link surfaces without changing native semantics', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const button = root.querySelector('button')!;
    const link = root.querySelector('a')!;

    expect(button.dataset['buttonVariant']).toBe('ghost');
    expect(link.dataset['buttonVariant']).toBe('ghost');
    expect(button.type).toBe('button');
    expect(link.getAttribute('href')).toBe('#target');

    fixture.componentInstance.variant.set('link');
    fixture.componentInstance.disabled.set(true);
    await fixture.whenStable();

    expect(button.dataset['buttonVariant']).toBe('link');
    expect(link.dataset['buttonVariant']).toBe('link');
    expect(button.disabled).toBe(true);
  });
});
