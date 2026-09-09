import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CheckoutConnection,
  CheckoutFailure,
  CheckoutList,
  CheckoutOperation,
  type CheckoutRequest,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom, map } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class CheckoutApi {
  private readonly http = inject(HttpClient);
  connection() {
    return firstValueFrom(
      this.http
        .get<unknown>('/api/integrations/checkout/connection')
        .pipe(map((value) => Schema.decodeUnknownSync(CheckoutConnection)(value))),
    );
  }
  list() {
    return this.http
      .get<unknown>('/api/integrations/checkout')
      .pipe(map((value) => Schema.decodeUnknownSync(CheckoutList)(value)));
  }
  create(request: CheckoutRequest) {
    return requestOutcome(
      this.http.post('/api/integrations/checkout', request),
      CheckoutOperation,
      CheckoutFailure,
      'checkout.error',
    );
  }
}
