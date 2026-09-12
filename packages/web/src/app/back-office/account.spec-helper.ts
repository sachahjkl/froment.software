import { signal, type Provider } from '@angular/core';
import {
  PermissionCodes,
  type CurrentAccountValue,
  type PermissionCodeValue,
} from '@froment/contracts';
import { Authentication } from './authentication';

export const accountFixture = (permissions: readonly PermissionCodeValue[] = PermissionCodes) => {
  const account = signal<CurrentAccountValue | undefined>({
    userId: '01ARZ3NDEKTSV4RRFFQ69G5FAA',
    email: 'account@example.test',
    mode: 'administrator',
    permissions,
    enabledModules: ['sales', 'purchasing', 'banking', 'accounting', 'tax', 'ai', 'demonstration'],
  });
  const authentication = {
    account: account.asReadonly(),
    can: (permission: PermissionCodeValue) => account()?.permissions.includes(permission) === true,
    sessionMode: async () => account()?.mode,
    currentAccount: async () => account(),
    refreshAccount: async () => account(),
  } satisfies Pick<
    Authentication,
    'account' | 'can' | 'sessionMode' | 'currentAccount' | 'refreshAccount'
  >;
  return {
    account,
    authentication,
    provider: { provide: Authentication, useValue: authentication },
  };
};

export const provideAccount = (
  permissions: readonly PermissionCodeValue[] = PermissionCodes,
): Provider => ({
  provide: Authentication,
  useFactory: () => accountFixture(permissions).authentication,
});
