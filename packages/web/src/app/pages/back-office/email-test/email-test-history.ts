import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { type EmailTestOperation } from '@froment/contracts';
import { catchError, EMPTY, exhaustMap, filter, type Observable, tap, timer } from 'rxjs';
import { ConnectionsApi } from '@backoffice/connections-api';

@Injectable()
export class EmailTestHistory {
  private readonly api = inject(ConnectionsApi);
  private readonly document = inject(DOCUMENT);
  readonly operations = signal<readonly EmailTestOperation[]>([]);
  readonly loaded = signal(false);
  readonly loading = signal(true);
  readonly paused = signal(false);
  private writeVersion = 0;

  watch(blocked: () => boolean = () => false): Observable<readonly EmailTestOperation[]> {
    return timer(0, 3000).pipe(
      filter(() => !this.paused() && !blocked() && this.document.visibilityState === 'visible'),
      exhaustMap(() => {
        const version = this.writeVersion;
        return this.api.emailTests().pipe(
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

  record(operation: EmailTestOperation): void {
    this.operations.update((items) => [
      operation,
      ...items.filter((item) => item.request.requestId !== operation.request.requestId),
    ]);
  }
}
