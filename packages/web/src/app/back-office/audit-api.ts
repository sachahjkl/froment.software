import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { GlobalAuditFailure, GlobalAuditPage, type GlobalAuditQuery } from '@froment/contracts';

import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);

  list(query: GlobalAuditQuery) {
    let params = new HttpParams();
    if (query.cursor !== undefined) params = params.set('cursor', query.cursor);
    if (query.direction !== undefined) params = params.set('direction', query.direction);
    if (query.limit !== undefined) params = params.set('limit', query.limit);
    if (query.action !== undefined) params = params.set('action', query.action);
    if (query.resourceType !== undefined) params = params.set('resourceType', query.resourceType);
    return requestOutcome(
      this.http.get<unknown>('/api/audit-events', { params }),
      GlobalAuditPage,
      GlobalAuditFailure,
      'audit.unavailable',
    );
  }
}
