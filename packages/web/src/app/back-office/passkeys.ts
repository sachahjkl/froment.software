import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  PasskeyList,
  PasskeyFailure,
  PasskeyRegistrationOptions,
  PasskeyLoginOptions,
  PasskeyRegistrationRequest,
  PasskeyRemovalRequest,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome, decodeApiFailure } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class Passkeys {
  private readonly http = inject(HttpClient);
  readonly supported = Reflect.has(globalThis, 'PublicKeyCredential') && globalThis.isSecureContext;

  list() {
    return requestOutcome(
      this.http.get('/api/auth/passkeys'),
      PasskeyList,
      PasskeyFailure,
      'passkey.error',
    );
  }

  async register(request: typeof PasskeyRegistrationRequest.Type) {
    try {
      const payload = Schema.decodeUnknownSync(PasskeyRegistrationRequest)(request);
      const options = Schema.decodeUnknownSync(PasskeyRegistrationOptions)(
        await firstValueFrom(this.http.post('/api/auth/passkeys/register/options', payload)),
      );
      const { startRegistration } = await import('@simplewebauthn/browser');
      const response = await startRegistration({
        optionsJSON: {
          ...options,
          pubKeyCredParams: [...options.pubKeyCredParams],
          excludeCredentials: [...options.excludeCredentials],
        },
      });
      await firstValueFrom(this.http.post('/api/auth/passkeys/register/verify', response));
      return { success: true as const };
    } catch (cause) {
      return decodeApiFailure({ cause }, PasskeyFailure, 'passkey.error');
    }
  }

  async remove(id: string, request: typeof PasskeyRemovalRequest.Type) {
    try {
      await firstValueFrom(
        this.http.post(
          `/api/auth/passkeys/${encodeURIComponent(id)}/remove`,
          Schema.decodeUnknownSync(PasskeyRemovalRequest)(request),
        ),
      );
      return { success: true as const };
    } catch (cause) {
      return decodeApiFailure({ cause }, PasskeyFailure, 'passkey.error');
    }
  }

  async assertion() {
    const optionsJSON = Schema.decodeUnknownSync(PasskeyLoginOptions)(
      await firstValueFrom(this.http.post('/api/auth/passkeys/login/options', {})),
    );
    const { startAuthentication } = await import('@simplewebauthn/browser');
    return startAuthentication({ optionsJSON });
  }
}
