import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Reminder, ReminderCreate, ReminderList, ReminderFailure } from '@froment/contracts';
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
  create(id: string, request: typeof ReminderCreate.Type) {
    return requestOutcome(
      this.http.put(`/api/reminders/${id}`, request),
      Reminder,
      ReminderFailure,
      'reminder.error',
    );
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
