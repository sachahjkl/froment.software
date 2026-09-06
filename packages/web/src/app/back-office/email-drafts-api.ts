import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EmailDraft, EmailDraftList, EmailDraftSave, EmailDraftFailure } from '@froment/contracts';
import { firstValueFrom } from 'rxjs';
import { requestOutcome, decodeApiFailure } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class EmailDraftsApi {
  private readonly http = inject(HttpClient);
  list() {
    return requestOutcome(
      this.http.get('/api/email-drafts'),
      EmailDraftList,
      EmailDraftFailure,
      'emailDraft.error',
    );
  }
  save(id: string, request: typeof EmailDraftSave.Type) {
    return requestOutcome(
      this.http.put(`/api/email-drafts/${id}`, request),
      EmailDraft,
      EmailDraftFailure,
      'emailDraft.error',
    );
  }
  async archive(draft: typeof EmailDraft.Type) {
    try {
      await firstValueFrom(
        this.http.post(`/api/email-drafts/${draft.id}/archive`, { expectedVersion: draft.version }),
      );
      return { success: true as const };
    } catch (cause) {
      return decodeApiFailure({ cause }, EmailDraftFailure, 'emailDraft.error');
    }
  }
}
