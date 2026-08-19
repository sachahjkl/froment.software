import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { DeploymentMetadata, type DeploymentMetadataValue } from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VersionApi {
  private readonly http = inject(HttpClient);

  async get(): Promise<DeploymentMetadataValue> {
    const response = await firstValueFrom(this.http.get<unknown>('/api/version'));
    return Schema.decodeUnknownSync(DeploymentMetadata)(response);
  }
}
