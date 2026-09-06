import type { CanDeactivateFn } from '@angular/router';

import type { UnsavedChangesPage } from './unsaved-changes-guard';

export const pendingApiTokenGuard: CanDeactivateFn<UnsavedChangesPage> = (component) =>
  component.canDeactivate();
