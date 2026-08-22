import type { CanDeactivateFn } from '@angular/router';

import type { IntegrationTokens } from '@app/pages/back-office/integration-tokens/integration-tokens';

export const pendingIntegrationTokenGuard: CanDeactivateFn<IntegrationTokens> = (component) =>
  component.canDeactivate();
