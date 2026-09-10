import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { type CheckoutOperation } from '@froment/contracts';
import { catchError, EMPTY, exhaustMap, filter, type Observable, tap, timer } from 'rxjs';
import { CheckoutApi } from '@backoffice/checkout-api';

@Injectable()
export class CheckoutHistory {
  private readonly api = inject(CheckoutApi);
  private readonly document = inject(DOCUMENT);
  readonly operations = signal<readonly CheckoutOperation[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(true);
  readonly paused = signal(false);
  private writeVersion = 0;

  watch(blocked: () => boolean = () => false): Observable<readonly CheckoutOperation[]> {
    return timer(0, 3000).pipe(
      filter(() => !this.paused() && !blocked() && this.document.visibilityState === 'visible'),
      exhaustMap(() => {
        const version = this.writeVersion;
        return this.api.list().pipe(
          filter(() => version === this.writeVersion),
          catchError(() => {
            if (version === this.writeVersion) {
              this.paused.set(true);
              this.loading.set(false);
            }
            return EMPTY;
          }),
        );
      }),
      tap((operations) => {
        this.operations.set(operations);
        this.loaded.set(true);
        this.loading.set(false);
      }),
    );
  }

  refresh(): void {
    this.paused.set(false);
    this.loading.set(true);
  }

  invalidate(): void {
    this.writeVersion++;
  }

  record(operation: CheckoutOperation): void {
    this.operations.update((items) => [
      operation,
      ...items.filter((item) => item.request.requestId !== operation.request.requestId),
    ]);
  }
}
