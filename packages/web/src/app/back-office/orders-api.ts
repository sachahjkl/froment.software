import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { OrderList, type OrderListValue } from '@froment/contracts';
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
}
