import { Dialog } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '@app/i18n.service';
import { Confirmation } from './confirmation';

@Component({ template: '<button type="button">Open</button>' })
class ConfirmationHost {}

describe('Confirmation', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ConfirmationHost);
    await fixture.whenStable();
    const service = TestBed.inject(Confirmation);
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    trigger.focus();
    return { fixture, service, overlay, trigger };
  }

  it('labels the dialog and localizes the buttons in both languages', async () => {
    const { fixture, service, overlay } = await setup();
    for (const language of ['fr', 'en'] as const) {
      TestBed.inject(I18nService).setLanguage(language);
      const result = service.request('Delete this record?');
      await fixture.whenStable();
      const dialog = overlay.querySelector('[role="alertdialog"]')!;
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('confirmation-title');
      expect(dialog.getAttribute('aria-describedby')).toBe('confirmation-message');
      expect(dialog.querySelector('#confirmation-message')?.textContent).toBe(
        'Delete this record?',
      );
      const buttons = dialog.querySelectorAll('button');
      expect(buttons[0].textContent?.trim()).toBe(language === 'fr' ? 'Annuler' : 'Cancel');
      expect(buttons[1].textContent?.trim()).toBe(language === 'fr' ? 'Confirmer' : 'Confirm');
      buttons[1].click();
      expect(await result).toBe(true);
      expect(overlay.querySelector('[role="alertdialog"]')).toBeNull();
    }
  });

  it('focuses cancel first and restores the trigger after cancellation', async () => {
    const { fixture, service, overlay, trigger } = await setup();
    const result = service.request('Discard changes?');
    await fixture.whenStable();
    const cancel = overlay.querySelector<HTMLButtonElement>('[data-confirmation-cancel]')!;
    expect(document.activeElement).toBe(cancel);
    expect(overlay.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(2);
    cancel.click();
    expect(await result).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(overlay.querySelectorAll('.cdk-focus-trap-anchor')).toHaveLength(0);
  });
  it('uses the explicit action label and destructive treatment', async () => {
    const { fixture, service, overlay } = await setup();
    const result = service.request('Discard changes?', {
      acceptLabel: 'Discard changes',
      variant: 'danger',
    });
    await fixture.whenStable();
    const action = overlay.querySelector<HTMLButtonElement>('[data-button-variant="danger"]');
    expect(action?.textContent?.trim()).toBe('Discard changes');
    action?.click();
    expect(await result).toBe(true);
  });

  it('requests a secret without exposing it outside the result', async () => {
    const { fixture, service, overlay } = await setup();
    const result = service.requestSecret('Reset all data?', 'Reset password', {
      acceptLabel: 'Reset',
      variant: 'danger',
    });
    await fixture.whenStable();
    const input = overlay.querySelector<HTMLInputElement>('[data-confirmation-secret]')!;
    const action = overlay.querySelector<HTMLButtonElement>('[type="submit"]')!;
    expect(document.activeElement).toBe(input);
    expect(input.type).toBe('password');
    expect(action.disabled).toBe(true);
    input.value = 'demo-secret';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(action.disabled).toBe(false);
    action.click();
    expect(await result).toBe('demo-secret');
  });

  it('returns false for Escape and backdrop clicks', async () => {
    const { fixture, service, overlay } = await setup();
    const escaped = service.request('Discard changes?');
    await fixture.whenStable();
    overlay
      .querySelector('button')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    expect(await escaped).toBe(false);
    const dismissed = service.request('Delete this record?');
    await fixture.whenStable();
    overlay.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click();
    expect(await dismissed).toBe(false);
  });

  it('rejects concurrent requests without sharing an approval', async () => {
    const { fixture, service, overlay } = await setup();
    const first = service.request('First action');
    expect(await service.request('Second action')).toBe(false);
    await fixture.whenStable();
    expect(overlay.querySelectorAll('[role="alertdialog"]')).toHaveLength(1);
    expect(overlay.textContent).not.toContain('Second action');
    overlay.querySelectorAll('button')[1].click();
    expect(await first).toBe(true);
    const next = service.request('Third action');
    TestBed.inject(Dialog).closeAll();
    expect(await next).toBe(false);
  });

  it('resolves pending requests safely when the service is destroyed', async () => {
    const { service } = await setup();
    const result = service.request('Delete this record?');
    TestBed.resetTestingModule();
    expect(await result).toBe(false);
    expect(await service.request('Another action')).toBe(false);
  });
});
