import type { CanDeactivateFn } from '@angular/router';

import type { ApiTokens } from '@app/pages/back-office/api-tokens/api-tokens';

export const pendingApiTokenGuard: CanDeactivateFn<ApiTokens> = (component) =>
  component.canDeactivate();
