import { type ProviderConnection } from '@froment/contracts';
import { type I18nService } from '@app/i18n.service';
import { type TabItem } from '@shared/tabs/tabs';
import { type ParamMap } from '@angular/router';
import {
  workspaceTableParams,
  workspaceTableQuery,
  type WorkspaceTableParams,
} from '../configuration/workspace-table';
import { checkoutTableOptions, emailTableOptions } from '../configuration/workspace-tables';

export type ConnectionProvider = typeof ProviderConnection.Type.provider;

export function providerTabs(
  provider: ConnectionProvider,
  i18n: I18nService,
  requestId?: string | null,
): readonly TabItem[] {
  if (provider !== 'stripe' && provider !== 'resend') return [];
  const path = `/backoffice/services/${provider}`;
  return [
    {
      id: `${provider}-connection`,
      path,
      label: i18n.t('configurationWorkspace.connection'),
      queryParams: requestId ? { request: requestId } : undefined,
    },
    {
      id: `${provider}-tests`,
      path: `${path}/tests`,
      label: i18n.t('configurationWorkspace.tests'),
      exact: false,
    },
  ];
}

export function providerTestParams(
  provider: ConnectionProvider,
  params: ParamMap,
): WorkspaceTableParams {
  switch (provider) {
    case 'stripe':
      return workspaceTableParams(
        workspaceTableQuery(params, checkoutTableOptions),
        checkoutTableOptions,
      );
    case 'resend':
      return workspaceTableParams(
        workspaceTableQuery(params, emailTableOptions),
        emailTableOptions,
      );
    default:
      return {};
  }
}
