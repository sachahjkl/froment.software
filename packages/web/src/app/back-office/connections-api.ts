import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  EmailTestFailure,
  EmailTestList,
  EmailTestOperation,
  ProviderConnections,
  type EmailTestRequest,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom, map } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class ConnectionsApi {
  private readonly http = inject(HttpClient);
  connections() {
    return firstValueFrom(
      this.http
        .get<unknown>('/api/integrations/connections')
        .pipe(map((value) => Schema.decodeUnknownSync(ProviderConnections)(value))),
    );
  }
  emailTests() {
    return this.http
      .get<unknown>('/api/integrations/email-tests')
      .pipe(map((value) => Schema.decodeUnknownSync(EmailTestList)(value)));
  }
  sendEmailTest(request: EmailTestRequest) {
    return requestOutcome(
      this.http.post<unknown>('/api/integrations/email-tests', request),
      EmailTestOperation,
      EmailTestFailure,
      'emailTest.error',
    );
  }
}
