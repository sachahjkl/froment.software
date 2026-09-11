import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IconToolbar, type IconToolbarGroup } from './icon-toolbar';

const groups: ReadonlyArray<IconToolbarGroup<string>> = [
  {
    label: 'Texte',
    items: [
      { value: 'bold', label: 'Gras', icon: 'bold', pressed: true, disabled: false },
      { value: 'italic', label: 'Italique', icon: 'italic', pressed: false, disabled: false },
      { value: 'undo', label: 'Annuler', icon: 'undo', pressed: null, disabled: true },
    ],
  },
];

const setup = async () => {
  const fixture = TestBed.createComponent(IconToolbar);
  fixture.componentRef.setInput('groups', groups);
  fixture.componentRef.setInput('label', 'Mise en forme');
  await fixture.whenStable();
  const root: HTMLElement = fixture.nativeElement;
  for (const bubble of root.querySelectorAll<HTMLElement>('[popover]')) {
    Object.defineProperties(bubble, {
      showPopover: { value: vi.fn() },
      hidePopover: { value: vi.fn() },
    });
  }
  return { fixture, root };
};

describe('IconToolbar', () => {
  it('uses arrow navigation with one tab stop and named icon buttons', async () => {
    const { fixture, root } = await setup();
    const first = root.querySelector<HTMLButtonElement>('button')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    const second = root.querySelectorAll<HTMLButtonElement>('button')[1]!;
    expect(document.activeElement).toBe(second);
    expect(root.querySelectorAll('button[tabindex="0"]')).toHaveLength(1);
    expect(root.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'Mise en forme',
    );
    expect(document.getElementById(second.getAttribute('aria-labelledby')!)?.textContent).toBe(
      'Italique',
    );
  });

  it('emits enabled actions and blocks disabled actions', async () => {
    const { fixture, root } = await setup();
    const activate = vi.fn();
    fixture.componentInstance.activated.subscribe(activate);
    const buttons = root.querySelectorAll<HTMLButtonElement>('button');
    buttons[0]!.click();
    buttons[2]!.click();
    expect(activate).toHaveBeenCalledExactlyOnceWith('bold');
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    buttons[0]!.click();
    expect(activate).toHaveBeenCalledOnce();
  });

  it('activates commands with Enter and Space without duplicate clicks', async () => {
    const { fixture, root } = await setup();
    const activate = vi.fn();
    fixture.componentInstance.activated.subscribe(activate);
    const button = root.querySelector<HTMLButtonElement>('button')!;
    button.focus();
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      button.dispatchEvent(event);
      await fixture.whenStable();
      expect(event.defaultPrevented).toBe(true);
    }
    expect(activate.mock.calls).toEqual([['bold'], ['bold']]);
  });

  it('activates the clicked command after Angular Aria moves focus', async () => {
    const { fixture, root } = await setup();
    const button = root.querySelectorAll<HTMLButtonElement>('button')[1]!;
    const focusOnActivation = vi.fn();
    fixture.componentInstance.activated.subscribe((value) => {
      focusOnActivation(value, document.activeElement);
    });
    button.dispatchEvent(new PointerEvent('click', { pointerType: 'mouse', bubbles: true }));
    expect(focusOnActivation).toHaveBeenCalledExactlyOnceWith('italic', button);
  });
});
