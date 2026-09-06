import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  Reminder,
  ReminderCreate,
  ReminderList,
  ReminderFailure,
  InvoiceDetail,
} from '@froment/contracts';
import { Schema } from 'effect';
import { firstValueFrom } from 'rxjs';
import { requestOutcome } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class RemindersApi {
  private readonly http = inject(HttpClient);
  list() {
    return requestOutcome(
      this.http.get('/api/reminders'),
      ReminderList,
      ReminderFailure,
      'reminder.error',
    );
  }
  async create(id: string, request: Omit<typeof ReminderCreate.Type, 'expectedVersion'>) {
    try {
      const invoice = Schema.decodeUnknownSync(InvoiceDetail)(
        await firstValueFrom(this.http.get(`/api/invoices/${request.invoiceId}`)),
      );
      return await requestOutcome(
        this.http.put(`/api/reminders/${id}`, { ...request, expectedVersion: invoice.version }),
        Reminder,
        ReminderFailure,
        'reminder.error',
      );
    } catch {
      return { success: false as const, code: 'reminder.error' as const };
    }
  }
  cancel(id: string) {
    return requestOutcome(
      this.http.post(`/api/reminders/${id}/cancel`, {}),
      Reminder,
      ReminderFailure,
      'reminder.error',
    );
  }
}
