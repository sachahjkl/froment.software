import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { NavigationFocus } from './navigation-focus';

@Component({ template: '<h1>Page</h1><input aria-label="Search" type="search" />' })
class TestPage {}

@Component({
  imports: [RouterOutlet],
  template: '<main id="main-content" tabindex="-1"><router-outlet /></main>',
})
class TestShell {}

describe('NavigationFocus', () => {
  let fixture: ComponentFixture<TestShell>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestShell],
      providers: [
        provideRouter([
          { path: 'one', component: TestPage },
          { path: 'two', component: TestPage },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TestShell);
    router = TestBed.inject(Router);
    TestBed.inject(NavigationFocus);
    await router.navigateByUrl('/one');
    await fixture.whenStable();
  });

  it('focuses main after a navigation following the initial route', async () => {
    await router.navigateByUrl('/two');
    await fixture.whenStable();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('main'));
  });
  it('retains focus during search and sort query changes', async () => {
    const search = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    search.focus();
    await router.navigateByUrl('/one?q=audit&sort=price-asc');
    await fixture.whenStable();
    expect(document.activeElement).toBe(search);
    await router.navigateByUrl('/one?q=angular&sort=price-desc');
    await fixture.whenStable();
    expect(document.activeElement).toBe(search);
  });
});
