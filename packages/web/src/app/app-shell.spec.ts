import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routeShell } from './app-shell';

@Component({ template: '' })
class ShellPage {}

describe('routeShell', () => {
  it('uses the most specific shell metadata', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'landing',
            data: { shell: 'landing' },
            children: [
              { path: 'detail', component: ShellPage },
              { path: 'about', component: ShellPage, data: { shell: 'public' } },
            ],
          },
          { path: 'unknown', component: ShellPage },
          { path: 'version', component: ShellPage, data: { shell: 'standalone' } },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/landing/detail');
    const shell = () => routeShell(TestBed.inject(Router).routerState.snapshot.root);
    expect(shell()).toBe('landing');
    await harness.navigateByUrl('/landing/about');
    expect(shell()).toBe('public');
    await harness.navigateByUrl('/unknown');
    expect(shell()).toBe('public');
    await harness.navigateByUrl('/version');
    expect(shell()).toBe('standalone');
  });
});
