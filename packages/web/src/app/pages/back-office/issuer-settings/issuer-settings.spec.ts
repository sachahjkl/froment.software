import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { IssuerSettingsApi } from '@backoffice/issuer-settings-api';
import { IssuerSettings } from './issuer-settings';

describe('IssuerSettings', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('keeps local changes and the expected version after a conflict', async () => {
    const settings = {
      displayName: 'Test',
      addressLine1: '',
      addressLine2: '',
      postalCode: '',
      city: '',
      country: '',
      email: '',
      phone: 'OLD',
      registrationNumber: '',
      vatNumber: 'VAT',
      version: 4,
    };
    const update = vi.fn().mockResolvedValue({ success: false, code: 'issuer.conflict' });
    TestBed.overrideProvider(IssuerSettingsApi, {
      useValue: { get: async () => settings, update },
    });
    const fixture = TestBed.createComponent(IssuerSettings);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component['settingsForm'].phone().value.set('NEW');
    component['save'](new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ phone: 'NEW', expectedVersion: 4 }),
    );
    expect(component['settingsForm'].phone().value()).toBe('NEW');
    expect(component['error']()).toBe('issuer.conflict');
    expect(component['saved']()).toBe(false);
  });

  it('blocks updates when the initial settings cannot be loaded', async () => {
    const update = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: IssuerSettingsApi,
          useValue: {
            get: async () => {
              throw new Error('Unavailable');
            },
            update,
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(IssuerSettings);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    fixture.componentInstance['save'](new SubmitEvent('submit'));
    expect(update).not.toHaveBeenCalled();
  });

  it('groups fields and focuses invalid identity without disabling submit', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: IssuerSettingsApi,
          useValue: {
            get: async () => ({
              version: 1,
              displayName: '',
              addressLine1: '',
              addressLine2: '',
              postalCode: '',
              city: '',
              country: '',
              email: '',
              phone: '',
              registrationNumber: '',
              vatNumber: '',
            }),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(IssuerSettings);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelectorAll('fieldset')).toHaveLength(3);
    const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(false);
    submit?.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('#issuer-display-name'));
    expect(root.querySelector('#issuer-display-name-error')).not.toBeNull();
  });
});
