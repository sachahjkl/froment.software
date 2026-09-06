import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  EmailTemplate,
  EmailTemplateList,
  EmailTemplateSave,
  EmailTemplateFailure,
} from '@froment/contracts';
import { firstValueFrom } from 'rxjs';
import { requestOutcome, decodeApiFailure } from '@shared/api-outcome';

@Injectable({ providedIn: 'root' })
export class EmailTemplatesApi {
  private readonly http = inject(HttpClient);
  list() {
    return requestOutcome(
      this.http.get('/api/email-templates'),
      EmailTemplateList,
      EmailTemplateFailure,
      'emailTemplate.error',
    );
  }
  save(id: string, request: typeof EmailTemplateSave.Type) {
    return requestOutcome(
      this.http.put(`/api/email-templates/${id}`, request),
      EmailTemplate,
      EmailTemplateFailure,
      'emailTemplate.error',
    );
  }
  async archive(template: typeof EmailTemplate.Type) {
    try {
      await firstValueFrom(
        this.http.post(`/api/email-templates/${template.id}/archive`, {
          expectedVersion: template.version,
        }),
      );
      return { success: true as const };
    } catch (cause) {
      return decodeApiFailure({ cause }, EmailTemplateFailure, 'emailTemplate.error');
    }
  }
}
