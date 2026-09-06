import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IntegrationFailure,
  IntegrationOperation,
  IntegrationOperationList,
  IntegrationStatusList,
  type IntegrationSubmissionValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly http = inject(HttpClient);
  async status() {
    return Schema.decodeUnknownSync(IntegrationStatusList)(
      await firstValueFrom(this.http.get<unknown>('/api/integrations')),
    );
  }
  async list() {
    return Schema.decodeUnknownSync(IntegrationOperationList)(
      await firstValueFrom(this.http.get<unknown>('/api/integrations/operations')),
    );
  }
  submit(request: IntegrationSubmissionValue) {
    return requestOutcome(
      this.http.post<unknown>('/api/integrations/operations', request),
      IntegrationOperation,
      IntegrationFailure,
      'integrations.error',
    );
  }
}
