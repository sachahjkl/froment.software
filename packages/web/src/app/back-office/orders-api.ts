import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  OrderDocumentArtifact,
  OrderList,
  type OrderDocumentArtifactValue,
  type OrderListValue,
  type UlidValue,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  async list(): Promise<OrderListValue> {
    return Schema.decodeUnknownSync(OrderList)(
      await firstValueFrom(this.http.get<unknown>('/api/orders')),
    );
  }

  previewUrl(orderId: UlidValue): string {
    return `/api/orders/${orderId}/preview`;
  }

  pdfUrl(orderId: UlidValue): string {
    return `/api/orders/${orderId}/pdf`;
  }

  async renderPdf(orderId: UlidValue): Promise<OrderDocumentArtifactValue> {
    return Schema.decodeUnknownSync(OrderDocumentArtifact)(
      await firstValueFrom(this.http.post<unknown>(this.pdfUrl(orderId), null)),
    );
  }
}
