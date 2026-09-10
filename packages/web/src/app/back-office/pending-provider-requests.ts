import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import {
  CheckoutRequest,
  EmailTestRequest,
  EmailSubmission,
  ReminderCreate,
  ReminderId,
} from '@froment/contracts';
import { Schema } from 'effect';
import { Authentication } from './authentication';

export interface PendingRequestStore<Request> {
  readonly read: () => Request | undefined;
  readonly write: (request: Request) => void;
  readonly clear: () => void;
}
export const PendingReminder = Schema.Struct({ requestId: ReminderId, request: ReminderCreate });

export const pendingRequestStore = <Request>(
  storage: Storage,
  key: string,
  schema: Schema.ConstraintDecoder<Request>,
): PendingRequestStore<Request> => ({
  read: () => {
    const value = storage.getItem(key);
    return value === null ? undefined : Schema.decodeUnknownSync(schema)(JSON.parse(value));
  },
  write: (request) =>
    storage.setItem(key, JSON.stringify(Schema.decodeUnknownSync(schema)(request))),
  clear: () => storage.removeItem(key),
});

@Injectable({ providedIn: 'root' })
export class PendingProviderRequests {
  private readonly authentication = inject(Authentication);
  private readonly document = inject(DOCUMENT);

  private async open<Request>(kind: string, schema: Schema.ConstraintDecoder<Request>) {
    const account = await this.authentication.currentAccount();
    const storage = this.document.defaultView?.sessionStorage;
    if (account === undefined || account.mode !== 'administrator' || storage === undefined)
      throw new Error('pending_request.storage_unavailable');
    return pendingRequestStore(storage, `froment.pending.${kind}.${account.userId}`, schema);
  }
  email() {
    return this.open('email-test', EmailTestRequest);
  }
  checkout() {
    return this.open('checkout', CheckoutRequest);
  }
  businessEmail() {
    return this.open('email-message', EmailSubmission);
  }
  reminder() {
    return this.open('email-reminder', PendingReminder);
  }
}
