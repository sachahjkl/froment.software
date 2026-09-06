import { Injectable, inject } from '@angular/core';
import { type InvoiceDetailValue, type UlidValue } from '@froment/contracts';
import { formatMoney } from '@froment/l10n';
import { I18nService } from '@app/i18n.service';
import { formatLocalizedDate } from '@shared/localized-date/localized-date-pipe';
import { ClientsApi } from './clients-api';
import { InvoicesApi } from './invoices-api';

export interface InvoiceReminderDraft {
  readonly recipient: string;
  readonly reference: string;
  readonly subject: string;
  readonly body: string;
}

export const reminderBalance = (invoice: InvoiceDetailValue): number => {
  if (invoice.status !== 'issued') return 0;
  return (
    invoice.currentRevision.totalCents -
    invoice.payments.reduce((total, payment) => {
      if (payment.cancelledAt !== null) return total;
      return total + payment.amountCents;
    }, 0)
  );
};

@Injectable({ providedIn: 'root' })
export class InvoiceReminder {
  private readonly invoices = inject(InvoicesApi);
  private readonly clients = inject(ClientsApi);
  private readonly i18n = inject(I18nService);

  async prepare(id: UlidValue): Promise<InvoiceReminderDraft | undefined> {
    const invoice = await this.invoices.get(id);
    if (!invoice.success) return undefined;
    const remaining = reminderBalance(invoice.result);
    const reference = invoice.result.invoiceNumber;
    if (remaining <= 0 || reference === null) return undefined;
    const client = await this.clients.get(invoice.result.clientId);
    if (!client.success) return undefined;
    const language = this.i18n.language();
    return {
      recipient: client.result.email,
      reference,
      subject: this.i18n.tf('emails.reminderSubject', { reference }),
      body: this.i18n.tf('emails.reminderBody', {
        reference,
        amount: formatMoney(remaining, language, invoice.result.currentRevision.currency),
        dueDate: formatLocalizedDate(invoice.result.currentRevision.dueDate, language, {
          dateStyle: 'long',
        }),
      }),
    };
  }
}
