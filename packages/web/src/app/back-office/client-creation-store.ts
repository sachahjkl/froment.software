import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { ClientCreateRequest, type ClientCreateRequestValue } from '@froment/contracts';
import { Schema } from 'effect';
import { Authentication } from './authentication';

export interface PendingClientCreation {
  readonly read: () => ClientCreateRequestValue | undefined;
  readonly write: (request: ClientCreateRequestValue) => void;
  readonly clear: () => void;
}

@Injectable({ providedIn: 'root' })
export class ClientCreationStore {
  private readonly authentication = inject(Authentication);
  private readonly document = inject(DOCUMENT);

  async open(): Promise<PendingClientCreation> {
    const account = await this.authentication.currentAccount();
    const storage = this.document.defaultView?.sessionStorage;
    if (account?.mode !== 'administrator' || storage === undefined) {
      throw new Error('client.creation_storage_error');
    }
    const key = `froment.pending.client-creation.${account.userId}`;
    return {
      read: () => {
        const value = storage.getItem(key);
        return value === null
          ? undefined
          : Schema.decodeUnknownSync(Schema.fromJsonString(ClientCreateRequest))(value);
      },
      write: (request) =>
        storage.setItem(
          key,
          Schema.encodeSync(Schema.fromJsonString(ClientCreateRequest))(request),
        ),
      clear: () => storage.removeItem(key),
    };
  }
}
