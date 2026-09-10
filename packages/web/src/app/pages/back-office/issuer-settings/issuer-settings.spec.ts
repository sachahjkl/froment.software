import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { IssuerSettingsApi } from '@backoffice/issuer-settings-api';
import { IssuerSettings } from './issuer-settings';

describe('IssuerSettings', () => {
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
