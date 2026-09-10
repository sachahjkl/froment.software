import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Hint } from './hint';

@Component({
  imports: [Hint],
  template: `
    <app-hint #hint text="Exporter les résultats affichés (CSV)">
      <button
        type="button"
        aria-label="Exporter les résultats affichés (CSV)"
        [attr.aria-describedby]="hint.id"
      >
        CSV
      </button>
    </app-hint>
  `,
})
class HintExample {}

describe('Hint', () => {
  let fixture: ComponentFixture<HintExample>;
  let host: HTMLElement;
  let bubble: HTMLElement;
  let button: HTMLButtonElement;
  let show: ReturnType<typeof vi.fn>;
  let hide: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HintExample);
    await fixture.whenStable();
    host = fixture.nativeElement.querySelector('app-hint');
    bubble = host.querySelector('[popover]')!;
    button = host.querySelector('button')!;
    show = vi.fn();
    hide = vi.fn();
    Object.defineProperties(bubble, {
      showPopover: { value: show },
      hidePopover: { value: hide },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('uses a native hint popover as the named button description', () => {
    expect(bubble.getAttribute('popover')).toBe('hint');
    expect(bubble.getAttribute('role')).toBe('tooltip');
    expect(button.getAttribute('aria-describedby')).toBe(bubble.id);
    expect(button.getAttribute('aria-label')).toBe('Exporter les résultats affichés (CSV)');
    expect(button.hasAttribute('title')).toBe(false);
  });

  it('opens on hover and stays open while the pointer enters the hint', () => {
    host.dispatchEvent(new Event('pointerenter'));
    expect(show).toHaveBeenCalledOnce();
    host.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(100);
    bubble.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(200);
    expect(hide).not.toHaveBeenCalled();
    bubble.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(150);
    expect(hide).toHaveBeenCalledOnce();
  });

  it('opens on focus and remains open when only the pointer leaves', () => {
    button.focus();
    expect(show).toHaveBeenCalledOnce();
    host.dispatchEvent(new Event('pointerenter'));
    host.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(150);
    expect(hide).not.toHaveBeenCalled();
    button.blur();
    vi.advanceTimersByTime(150);
    expect(hide).toHaveBeenCalledOnce();
  });

  it('dismisses with Escape without moving focus or reopening immediately', () => {
    const parentKeydown = vi.fn();
    host.addEventListener('keydown', parentKeydown);
    button.focus();
    button.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(hide).toHaveBeenCalledOnce();
    expect(parentKeydown).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
    host.dispatchEvent(new Event('pointerenter'));
    expect(show).toHaveBeenCalledOnce();
    button.blur();
    host.dispatchEvent(new Event('pointerleave'));
    vi.advanceTimersByTime(150);
    button.focus();
    expect(show).toHaveBeenCalledTimes(2);
  });

  it('dismisses a hover hint with Escape when focus is elsewhere', () => {
    host.dispatchEvent(new Event('pointerenter'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(hide).toHaveBeenCalledOnce();
  });

  it('cancels delayed closing when the component is destroyed', () => {
    host.dispatchEvent(new Event('pointerenter'));
    host.dispatchEvent(new Event('pointerleave'));
    fixture.destroy();
    vi.advanceTimersByTime(150);
    expect(hide).not.toHaveBeenCalled();
  });
});
