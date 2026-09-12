import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CustomRole,
  CustomRoleCreateRequest,
  CustomRoleFailure,
  CustomRoleList,
  CustomRoleUpdateRequest,
} from '@froment/contracts';
import { Schema } from 'effect';

import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class RolesApi {
  private readonly http = inject(HttpClient);

  list() {
    return requestOutcome(
      this.http.get('/api/roles'),
      CustomRoleList,
      CustomRoleFailure,
      'role.error',
    );
  }

  get(id: string) {
    return requestOutcome(
      this.http.get(`/api/roles/${id}`),
      CustomRole,
      CustomRoleFailure,
      'role.error',
    );
  }

  create(request: typeof CustomRoleCreateRequest.Type) {
    return requestOutcome(
      this.http.post('/api/roles', request),
      CustomRole,
      CustomRoleFailure,
      'role.error',
    );
  }

  update(id: string, request: typeof CustomRoleUpdateRequest.Type) {
    return requestOutcome(
      this.http.put(`/api/roles/${id}`, request),
      CustomRole,
      CustomRoleFailure,
      'role.error',
    );
  }

  remove(id: string) {
    return requestOutcome(
      this.http.delete(`/api/roles/${id}`),
      Schema.Null,
      CustomRoleFailure,
      'role.error',
    );
  }
}
