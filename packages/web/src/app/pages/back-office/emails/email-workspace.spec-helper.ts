import { Component } from '@angular/core';
import { provideAccount } from '@backoffice/account.spec-helper';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import {
  EmailSubmission,
  type EmailDraft,
  type EmailDraftSave,
  type EmailTemplate,
  type EmailTemplateSave,
} from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { EmailDraftsApi } from '@backoffice/email-drafts-api';
import { EmailTemplatesApi } from '@backoffice/email-templates-api';
import { RemindersApi } from '@backoffice/reminders-api';
import { InvoicesApi } from '@backoffice/invoices-api';
import { InvoiceReminder } from '@backoffice/invoice-reminder';
import {
  PendingProviderRequests,
  PendingReminder,
  pendingRequestStore,
} from '@backoffice/pending-provider-requests';
import { unsavedChangesGuard } from '@backoffice/unsaved-changes-guard';
import { Confirmation } from '@shared/confirmation/confirmation';
import { TabPanelOutlet } from '@shared/tabs/tab-panel';
import { Emails } from './emails';
import { EmailComposer } from '../email-composer/email-composer';
import { EmailDetail } from '../email-detail/email-detail';
import { EmailTemplateEditor } from '../email-template-editor/email-template-editor';
import { ReminderEditor } from '../reminder-editor/reminder-editor';

export const emailDraftId = '91ff5717-c394-4708-bef2-6b5f5cafbdaa';
export const emailTemplateId = '91ff5717-c394-4708-bef2-6b5f5cafbdab';
export const invoiceId = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
export const operationId = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
export const request = EmailSubmission.make({
  kind: 'email',
  requestId: emailDraftId,
  expectedMode: 'simulation',
  recipient: 'client@example.test',
  reference: 'FA-2026-000001',
  subject: 'Votre facture',
  body: '<b>Texte littéral</b>',
});
export const operation = {
  id: operationId,
  request,
  createdAt: '2026-09-06T10:00:00.000Z',
  createdByUserId: invoiceId,
  receipt: {
    id: `simulation:${emailDraftId}`,
    mode: 'simulation' as const,
    status: 'simulated' as const,
  },
};
export const invoice = {
  version: 2,
  id: invoiceId,
  invoiceNumber: 'FA-2026-000001',
  title: 'Audit',
  clientDisplayName: 'Atelier',
  status: 'issued',
  creditedCents: 0,
  recordedPaidCents: 2500,
  totalCents: 10000,
  dueDate: '2026-09-20',
};

@Component({ template: '<h1>Destination</h1>' })
class Destination {}

export async function setupEmailPage(path: string) {
  sessionStorage.clear();
  const store = pendingRequestStore(sessionStorage, 'test.email-message', EmailSubmission);
  const reminderStore = pendingRequestStore(sessionStorage, 'test.email-reminder', PendingReminder);
  const api = {
    status: vi.fn().mockResolvedValue([{ kind: 'email', mode: 'simulation' }]),
    list: vi.fn().mockResolvedValue([operation]),
    submit: vi.fn().mockImplementation(async (request: typeof EmailSubmission.Type) => ({
      success: true,
      result: { ...operation, request },
    })),
  };
  const draftItems = new Map<string, typeof EmailDraft.Type>();
  const drafts = {
    list: vi
      .fn()
      .mockImplementation(async () => ({ success: true, result: [...draftItems.values()] })),
    save: vi.fn().mockImplementation(async (id: string, request: typeof EmailDraftSave.Type) => {
      const result = {
        ...request,
        id,
        version: request.expectedVersion + 1,
        updatedAt: operation.createdAt,
      };
      draftItems.set(id, result);
      return { success: true, result };
    }),
    archive: vi.fn().mockResolvedValue({ success: true }),
  };
  const templateItems = new Map<string, typeof EmailTemplate.Type>([
    [
      emailTemplateId,
      {
        id: emailTemplateId,
        subject: 'Modèle de facture',
        body: '<b>Texte du modèle</b>',
        version: 3,
        updatedAt: operation.createdAt,
      },
    ],
  ]);
  const templates = {
    list: vi
      .fn()
      .mockImplementation(async () => ({ success: true, result: [...templateItems.values()] })),
    save: vi.fn().mockImplementation(async (id: string, request: typeof EmailTemplateSave.Type) => {
      const result = {
        ...request,
        id,
        version: request.expectedVersion + 1,
        updatedAt: operation.createdAt,
      };
      templateItems.set(id, result);
      return { success: true, result };
    }),
    archive: vi.fn().mockResolvedValue({ success: true }),
  };
  const reminders = {
    list: vi.fn().mockResolvedValue({ success: true, result: [] }),
    create: vi.fn().mockResolvedValue({ success: true, result: {} }),
    cancel: vi.fn().mockResolvedValue({ success: true, result: {} }),
  };
  const invoices = { list: vi.fn().mockResolvedValue([invoice]) };
  const reminder = {
    prepare: vi.fn().mockResolvedValue({
      recipient: request.recipient,
      reference: request.reference,
      subject: request.subject,
      body: request.body,
    }),
  };
  const confirmation = { request: vi.fn().mockResolvedValue(false) };
  const navigation = { allowList: true };
  TestBed.configureTestingModule({
    providers: [
      provideAccount(),
      provideRouter([
        {
          path: 'backoffice/emails/new',
          component: EmailComposer,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/emails/drafts/:draftId/edit',
          component: EmailComposer,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/emails/templates/new',
          component: EmailTemplateEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/emails/templates/:templateId/edit',
          component: EmailTemplateEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/emails/reminders/new',
          component: ReminderEditor,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/emails/messages/:operationId',
          component: EmailDetail,
          canDeactivate: [unsavedChangesGuard],
        },
        {
          path: 'backoffice/emails',
          component: Emails,
          canActivate: [() => navigation.allowList],
          canDeactivate: [unsavedChangesGuard],
          children: ['messages', 'drafts', 'templates', 'reminders'].map((tab) => ({
            path: tab,
            component: TabPanelOutlet,
            data: { panel: 'emails', tab },
          })),
        },
        { path: 'other', component: Destination },
      ]),
      { provide: IntegrationsApi, useValue: api },
      { provide: EmailDraftsApi, useValue: drafts },
      { provide: EmailTemplatesApi, useValue: templates },
      { provide: RemindersApi, useValue: reminders },
      { provide: InvoicesApi, useValue: invoices },
      { provide: InvoiceReminder, useValue: reminder },
      { provide: Confirmation, useValue: confirmation },
      {
        provide: PendingProviderRequests,
        useValue: {
          businessEmail: vi.fn().mockResolvedValue(store),
          reminder: vi.fn().mockResolvedValue(reminderStore),
        },
      },
    ],
  });
  const harness = await RouterTestingHarness.create(path);
  await harness.fixture.whenStable();
  const root = harness.fixture.nativeElement as HTMLElement;
  const fill = async (id: string, value: string) => {
    const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
  };
  const save = async () => {
    root.querySelector('form')!.dispatchEvent(new SubmitEvent('submit'));
    await harness.fixture.whenStable();
  };
  return {
    root,
    harness,
    api,
    drafts,
    draftItems,
    templates,
    templateItems,
    reminders,
    invoices,
    reminder,
    confirmation,
    navigation,
    store,
    reminderStore,
    fill,
    save,
    router: TestBed.inject(Router),
  };
}
