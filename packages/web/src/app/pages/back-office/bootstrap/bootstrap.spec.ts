import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BootstrapApi, type BootstrapOutcome } from '@backoffice/bootstrap-api';
import { I18nService } from '../../../i18n.service';
import { Bootstrap } from './bootstrap';

class BootstrapApiStub {
  status(): Promise<boolean> {
    return Promise.resolve(true);
  }

  create(): Promise<BootstrapOutcome> {
    return Promise.resolve({
      success: true,
      result: {
        accessToken: 'v4.public.test',
        expiresAt: Date.now() + 600_000,
        mode: 'administrator',
      },
    });
  }
}

describe('Bootstrap', () => {
  it('creates the administrator with email and password credentials', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BootstrapApi, useClass: BootstrapApiStub }],
    });
    TestBed.inject(I18nService).setLanguage('en');
    const fixture = TestBed.createComponent(Bootstrap);
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const inputs = root.querySelectorAll<HTMLInputElement>('input');
    expect(inputs).toHaveLength(3);
    const values = ['bootstrap-password', 'administrator@example.test', 'administrator-password'];
    inputs.forEach((input, index) => {
      input.value = values[index] ?? '';
      input.dispatchEvent(new Event('input'));
    });
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(root.textContent).toContain('The administrator account is ready.');
  });
});
