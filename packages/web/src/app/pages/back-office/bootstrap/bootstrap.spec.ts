import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BootstrapApi, type BootstrapOutcome } from '@backoffice/bootstrap-api';
import { Bootstrap } from './bootstrap';

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

describe('Bootstrap', () => {
  it('creates the administrator and displays its identifier', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: BootstrapApi, useClass: BootstrapApiStub }],
    });
    const fixture = TestBed.createComponent(Bootstrap);
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
