import { type CanDeactivateFn } from '@angular/router';

export interface UnsavedChangesPage {
  canDeactivate(): boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<UnsavedChangesPage> = (page) =>
  page.canDeactivate();
