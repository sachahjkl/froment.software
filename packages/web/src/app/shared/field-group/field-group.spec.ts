import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FieldGroup } from './field-group';

@Component({
  imports: [FieldGroup],
  template: `<fieldset appFieldGroup legend="Contact" description="Required contact details">
    <label for="group-email">Email</label><input id="group-email" type="email" />
  </fieldset>`,
})
class FieldHost {}

describe('FieldGroup', () => {
  it('keeps native grouping and caller-owned label associations', async () => {
    const fixture = TestBed.createComponent(FieldHost);
    await fixture.whenStable();
    const fieldset: HTMLFieldSetElement = fixture.nativeElement.querySelector('fieldset');
    expect(fieldset.querySelector('legend')?.textContent).toBe('Contact');
    expect(fieldset.textContent).toContain('Required contact details');
    expect(fieldset.querySelector('input')?.labels?.[0].textContent).toBe('Email');
  });
});
