import { OverlayContainer } from '@angular/cdk/overlay';
import { TestBed } from '@angular/core/testing';
import { SplitAction } from './split-action';

describe('SplitAction', () => {
  it('keeps the primary command and related variants independent', async () => {
    const fixture = TestBed.createComponent(SplitAction);
    fixture.componentRef.setInput('primaryLabel', 'Create');
    fixture.componentRef.setInput('menuLabel', 'Creation variants');
    fixture.componentRef.setInput('actions', [{ id: 'example', label: 'Create from example' }]);
    const primary = vi.fn();
    const selected = vi.fn();
    fixture.componentInstance.primaryAction.subscribe(primary);
    fixture.componentInstance.actionSelected.subscribe(selected);
    await fixture.whenStable();
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    expect(primary).toHaveBeenCalledOnce();
    expect(selected).not.toHaveBeenCalled();
    fixture.componentRef.setInput('primaryDisabled', true);
    await fixture.whenStable();
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(false);
    buttons[1].click();
    await fixture.whenStable();
    TestBed.inject(OverlayContainer)
      .getContainerElement()
      .querySelector<HTMLButtonElement>('[role="menuitem"]')!
      .click();
    expect(selected).toHaveBeenCalledExactlyOnceWith('example');
  });
});
