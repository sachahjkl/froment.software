import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Can } from './can';
import { accountFixture } from './account.spec-helper';

@Component({ imports: [Can], template: `<button *appCan="'client.create'">Create</button>` })
class PermissionAction {}

describe('Can', () => {
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
