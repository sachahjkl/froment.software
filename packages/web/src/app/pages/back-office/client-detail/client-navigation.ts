import { type ParamMap } from '@angular/router';
import { clientFilterQuery, clientFilters, clientView } from '../clients/client-filters';
import { workspaceTableParams, workspaceTableQuery } from '../configuration/workspace-table';
import { clientAccessPeriod } from './client-access-period';
import {
  clientAccessTableOptions,
  clientAffairTableOptions,
  clientDocumentTableOptions,
} from './client-tables';

export function clientNavigationQuery(params: ParamMap) {
  const affairs = workspaceTableParams(
    workspaceTableQuery(params, clientAffairTableOptions),
    clientAffairTableOptions,
  );
  const documents = workspaceTableParams(
    workspaceTableQuery(params, clientDocumentTableOptions),
    clientDocumentTableOptions,
  );
  const accesses = workspaceTableParams(
    workspaceTableQuery(params, clientAccessTableOptions),
    clientAccessTableOptions,
  );
  const period = clientAccessPeriod(params);
  const view = clientView(params.get('view'));
  return {
    ...clientFilterQuery(clientFilters(params)),
    view: view === 'active' ? undefined : view,
    clientAffairQ: affairs['clientAffairQ'],
    clientAffairSort: affairs['clientAffairSort'],
    clientAffairStatus: affairs['clientAffairStatus'],
    clientDocumentQ: documents['clientDocumentQ'],
    clientDocumentSort: documents['clientDocumentSort'],
    clientDocumentType: documents['clientDocumentType'],
    clientAccessQ: accesses['clientAccessQ'],
    clientAccessSort: accesses['clientAccessSort'],
    clientAccessFrom: period.from,
    clientAccessTo: period.to,
  };
}
