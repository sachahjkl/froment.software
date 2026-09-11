import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routeShell, withShell } from './app-shell';

@Component({ template: '' })
class ShellPage {}

describe('routeShell', () => {
  it('uses route metadata, including a public child of an administrator route', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          ...withShell('administrator', [
            {
              path: 'workspace',
              children: [
                { path: 'detail', component: ShellPage },
                { path: 'join', component: ShellPage, data: { shell: 'public' } },
              ],
            },
          ]),
          { path: 'backoffice/unknown', component: ShellPage },
          { path: 'customer', component: ShellPage, data: { shell: 'client' } },
          { path: 'version', component: ShellPage, data: { shell: 'standalone' } },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/workspace/detail');
    const shell = () => routeShell(TestBed.inject(Router).routerState.snapshot.root);
    expect(shell()).toBe('administrator');
    await harness.navigateByUrl('/workspace/join');
    expect(shell()).toBe('public');
    await harness.navigateByUrl('/backoffice/unknown');
    expect(shell()).toBe('public');
    await harness.navigateByUrl('/customer');
    expect(shell()).toBe('client');
    await harness.navigateByUrl('/version');
    expect(shell()).toBe('standalone');
  });
});
