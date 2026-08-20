import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  BackOfficeBootstrapApi,
  type BootstrapOutcome,
} from '@backoffice/back-office-bootstrap-api';
import { BackOfficeBootstrap } from './back-office-bootstrap';

class BootstrapApiStub {
  status(): Promise<boolean> {
    return Promise.resolve(true);
  }

  create(): Promise<BootstrapOutcome> {
    return Promise.resolve({
      success: true,
      result: {
        accessIdentifier: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    });
  }
}

describe('BackOfficeBootstrap', () => {
  it('creates the administrator and displays its identifier', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: BackOfficeBootstrapApi, useClass: BootstrapApiStub },
      ],
    });
    const fixture = TestBed.createComponent(BackOfficeBootstrap);
    await fixture.whenStable();

    const root: HTMLElement = fixture.nativeElement;
    const input = root.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = 'bootstrap-password';
    input.dispatchEvent(new Event('input'));
    root.querySelector<HTMLFormElement>('form')?.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(root.textContent).toContain('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  });
});
