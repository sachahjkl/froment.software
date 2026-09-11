import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Can } from './can';
import { accountFixture } from './account.spec-helper';

@Component({ imports: [Can], template: `<button *appCan="'client.create'">Create</button>` })
class PermissionAction {}

@Component({ imports: [Can], template: `<button *appCan="[]">Create</button>` })
class EmptyPermissionsAction {}

describe('Can', () => {
  it('denies an empty permission list even without an account', async () => {
    const context = accountFixture([]);
    context.account.set(undefined);
    TestBed.configureTestingModule({ providers: [context.provider] });
    const fixture = TestBed.createComponent(EmptyPermissionsAction);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
  it('reacts to effective permissions and removes actions after account invalidation', async () => {
    const context = accountFixture(['client.read']);
    TestBed.configureTestingModule({ providers: [context.provider] });
    const fixture = TestBed.createComponent(PermissionAction);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    context.account.update((account) => account && { ...account, permissions: ['client.create'] });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
    context.account.set(undefined);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
