import { ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { pendingApiTokenGuard } from './pending-api-token-guard';
import { unsavedChangesGuard } from './unsaved-changes-guard';

describe('deactivation guards', () => {
  for (const guard of [unsavedChangesGuard, pendingApiTokenGuard]) {
    it('passes synchronous and asynchronous decisions to the router', async () => {
      const route = new ActivatedRouteSnapshot();
      const state = { url: '/editing', root: route } as RouterStateSnapshot;
      for (const decision of [true, false]) {
        expect(guard({ canDeactivate: () => decision }, route, state, state)).toBe(decision);
        const result = Promise.resolve(decision);
        expect(guard({ canDeactivate: () => result }, route, state, state)).toBe(result);
        expect(await result).toBe(decision);
      }
    });
  }
});
