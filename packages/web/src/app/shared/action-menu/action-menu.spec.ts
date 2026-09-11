import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { ActionMenu } from './action-menu';

describe('ActionMenu', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ActionMenu);
    fixture.componentRef.setInput('label', 'Actions for Atlas');
    fixture.componentRef.setInput('actions', [
      { id: 'edit', label: 'Edit' },
      { id: 'locked', label: 'Unavailable action', disabled: true },
      { id: 'delete', label: 'Delete', danger: true },
    ]);
    const selected = vi.fn();
    fixture.componentInstance.actionSelected.subscribe(selected);
    await fixture.whenStable();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    return { fixture, trigger, overlay, selected };
  }

  function key(element: Element, value: string, keyCode: number) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: value, keyCode, bubbles: true }));
  }

  it('uses ghost for the more trigger and preserves the requested button variant', async () => {
    const { fixture, trigger } = await setup();
    fixture.componentRef.setInput('variant', 'link');
    fixture.componentRef.setInput('appearance', 'more');
    await fixture.whenStable();

    expect(trigger.dataset['buttonVariant']).toBe('ghost');
    expect(trigger.hasAttribute('data-button-icon-only')).toBe(true);
    expect(trigger.getAttribute('aria-label')).toBe('Actions for Atlas');

    fixture.componentRef.setInput('appearance', 'button');
    await fixture.whenStable();

    expect(trigger.dataset['buttonVariant']).toBe('link');
    expect(trigger.hasAttribute('data-button-icon-only')).toBe(false);
  });

  it('focuses disabled actions without activation and restores focus on Escape', async () => {
    const { fixture, trigger, overlay, selected } = await setup();
    trigger.focus();
    key(trigger, 'ArrowDown', 40);
    await fixture.whenStable();
    const items = overlay.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(overlay.querySelector('[role="menu"]')?.getAttribute('aria-label')).toBe(
      'Actions for Atlas',
    );
    expect(document.activeElement).toBe(items[0]);
    key(items[0], 'ArrowDown', 40);
    expect(document.activeElement).toBe(items[1]);
    expect(items[1].getAttribute('aria-disabled')).toBe('true');
    key(items[1], 'Enter', 13);
    items[1].click();
    expect(selected).not.toHaveBeenCalled();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    key(items[1], 'ArrowDown', 40);
    expect(document.activeElement).toBe(items[2]);
    key(items[2], 'Escape', 27);
    await fixture.whenStable();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('emits one enabled command and closes the menu', async () => {
    const { fixture, trigger, overlay, selected } = await setup();
    trigger.click();
    await fixture.whenStable();
    const items = overlay.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    items[1].click();
    expect(selected).not.toHaveBeenCalled();
    selected.mockImplementation(() => {
      expect(overlay.querySelector('[role="menu"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
    items[0].click();
    await fixture.whenStable();
    expect(selected).toHaveBeenCalledExactlyOnceWith('edit');
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
  });

  it('disables an empty or unavailable menu', async () => {
    const { fixture, trigger, overlay } = await setup();
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    trigger.click();
    expect(trigger.disabled).toBe(true);
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
    fixture.componentRef.setInput('disabled', false);
    fixture.componentRef.setInput('actions', []);
    await fixture.whenStable();
    expect(trigger.disabled).toBe(true);
  });
});
