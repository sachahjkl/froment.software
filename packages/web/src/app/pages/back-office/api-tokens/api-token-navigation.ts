import { computed, inject, Service } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { workspaceTableParams, workspaceTableQuery } from '../configuration/workspace-table';
import { tokenTableOptions } from '../configuration/workspace-tables';

@Service({ autoProvided: false })
export class ApiTokenNavigation {
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });
  readonly params = computed(() =>
    workspaceTableParams(workspaceTableQuery(this.query(), tokenTableOptions), tokenTableOptions),
  );
}
