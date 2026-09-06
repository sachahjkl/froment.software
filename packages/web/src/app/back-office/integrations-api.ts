import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  IntegrationFailure,
  IntegrationOperation,
  IntegrationOperationList,
  IntegrationStatusList,
  IntegrationRetryList,
  type IntegrationSubmissionValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly http = inject(HttpClient);
  async retries() {
    return Schema.decodeUnknownSync(IntegrationRetryList)(
      await firstValueFrom(this.http.get('/api/integrations/retries')),
    );
  }
  async status() {
    return Schema.decodeUnknownSync(IntegrationStatusList)(
      await firstValueFrom(this.http.get<unknown>('/api/integrations')),
    );
  }
  async list(kind?: IntegrationSubmissionValue['kind']) {
    return Schema.decodeUnknownSync(IntegrationOperationList)(
      await firstValueFrom(
        this.http.get<unknown>('/api/integrations/operations', {
          params: kind === undefined ? {} : { kind },
        }),
      ),
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
