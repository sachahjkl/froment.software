import { TestBed } from '@angular/core/testing';
import { ObjectPicker } from './object-picker';

describe('ObjectPicker', () => {
  it('filters named choices without allowing arbitrary values', async () => {
    const fixture = TestBed.createComponent(ObjectPicker);
    fixture.componentRef.setInput('label', 'Choose a service');
    fixture.componentRef.setInput('options', [
      { id: 'one', label: 'Développement Angular' },
      { id: 'two', label: 'Audit', detail: 'Comptabilité' },
    ]);
    let selected = '';
    fixture.componentInstance.selected.subscribe((value) => {
      selected = value;
    });
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Choose a service');
    const input = dialog.querySelector('input')!;
    input.value = 'developement';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(dialog.querySelectorAll('.option')).toHaveLength(1);
    dialog.querySelector<HTMLButtonElement>('.option')!.click();
    await fixture.whenStable();
    expect(selected).toBe('one');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
