import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  TeamAccept,
  TeamFailure,
  TeamInvite,
  TeamInviteResult,
  TeamList,
  TeamMemberUpdate,
} from '@froment/contracts';
import { Schema } from 'effect';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class TeamApi {
  private readonly http = inject(HttpClient);
  list() {
    return requestOutcome(this.http.get('/api/team'), TeamList, TeamFailure, 'team.error');
  }
  invite(request: typeof TeamInvite.Type) {
    return requestOutcome(
      this.http.post('/api/team/invitations', request),
      TeamInviteResult,
      TeamFailure,
      'team.error',
    );
  }
  cancel(id: string) {
    return requestOutcome(
      this.http.post(`/api/team/invitations/${id}/cancel`, {}),
      Schema.Null,
      TeamFailure,
      'team.error',
    );
  }
  update(id: string, request: typeof TeamMemberUpdate.Type) {
    return requestOutcome(
      this.http.put(`/api/team/members/${id}`, request),
      Schema.Null,
      TeamFailure,
      'team.error',
    );
  }
  accept(request: typeof TeamAccept.Type) {
    return requestOutcome(
      this.http.post('/api/team/accept', request),
      Schema.Null,
      TeamFailure,
      'team.error',
    );
  }
}
