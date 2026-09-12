import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DemoFailure, DemoResetResult } from '@froment/contracts';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class DemoApi {
  private readonly http = inject(HttpClient);
  reset(password: string) {
    return requestOutcome(
      this.http.post('/api/demo/reset', { password, confirmed: true }),
      DemoResetResult,
      DemoFailure,
      'demo.error',
    );
  }
}
