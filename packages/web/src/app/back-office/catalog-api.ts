import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  CatalogItem,
  CatalogItemList,
  CatalogFailure,
  type CatalogItemCreateRequestValue,
  type CatalogItemUpdateRequestValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  async list() {
    return Schema.decodeUnknownSync(CatalogItemList)(
      await firstValueFrom(this.http.get<unknown>('/api/catalog')),
    );
  }
  async create(request: CatalogItemCreateRequestValue) {
    return requestOutcome(
      this.http.post<unknown>('/api/catalog', request),
      CatalogItem,
      CatalogFailure,
      'catalog.error',
    );
  }
  async update(id: UlidValue, request: CatalogItemUpdateRequestValue) {
    return requestOutcome(
      this.http.put<unknown>(`/api/catalog/${id}`, request),
      CatalogItem,
      CatalogFailure,
      'catalog.error',
    );
  }
}
