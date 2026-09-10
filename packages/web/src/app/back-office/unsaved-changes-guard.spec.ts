import { ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { unsavedChangesGuard } from './unsaved-changes-guard';

describe('unsavedChangesGuard', () => {
  it('passes synchronous and asynchronous decisions to the router', async () => {
    const route = new ActivatedRouteSnapshot();
    const state = { url: '/editing', root: route } as RouterStateSnapshot;
    for (const decision of [true, false]) {
      expect(unsavedChangesGuard({ canDeactivate: () => decision }, route, state, state)).toBe(
        decision,
      );
      const result = Promise.resolve(decision);
      expect(unsavedChangesGuard({ canDeactivate: () => result }, route, state, state)).toBe(
        result,
      );
      expect(await result).toBe(decision);
    }
  });
});
