import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { InvoiceReminder } from '@backoffice/invoice-reminder';
import { vi } from 'vitest';
import {
  type IntegrationOperationValue,
  type IntegrationSubmissionValue,
  EmailDraft,
  EmailDraftSave,
} from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { Emails } from './emails';
import { EmailDraftsApi } from '@backoffice/email-drafts-api';
import { EmailTemplatesApi } from '@backoffice/email-templates-api';

class DraftApiStub {
  readonly items = new Map<string, typeof EmailDraft.Type>();
  async list() {
    return { success: true as const, result: [...this.items.values()] };
  }
  async save(id: string, request: typeof EmailDraftSave.Type) {
    const result = {
      ...request,
      id,
      version: request.expectedVersion + 1,
      updatedAt: '2026-09-06T10:00:00.000Z',
    };
    this.items.set(id, result);
    return { success: true as const, result };
  }
}

class EmailApiStub {
  fail = false;
  readonly requests: IntegrationSubmissionValue[] = [];
  async status() {
    return [{ kind: 'email', mode: 'simulation' }];
  }
  async list(): Promise<ReadonlyArray<IntegrationOperationValue>> {
    return [];
  }
  async submit(request: IntegrationSubmissionValue) {
    this.requests.push(request);
    if (this.fail) return { success: false as const, code: 'integrations.error' as const };
    return {
      success: true as const,
      result: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        request,
        createdAt: '2026-09-06T10:00:00.000Z',
        createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        receipt: {
          mode: 'simulation' as const,
          status: 'simulated' as const,
          id: `simulation:${request.requestId}`,
        },
      },
    };
  }
}
const fill = (root: HTMLElement, id: string, value: string) => {
  const input = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(id);
  if (input === null) throw new Error('email.input.missing');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const compose = (root: HTMLElement) => {
  fill(root, '#email-recipient', 'client@example.test');
  fill(root, '#email-reference', 'DE-2026-000001');
  fill(root, '#email-subject', 'Quote');
  fill(root, '#email-body', '<script>alert(1)</script>\nQuote details.');
};
describe('Emails', () => {
  it('copies template text without recipients, guards unsaved copies, and preserves text after a failed update', async () => {
    const template = {
      id: '91ff5717-c394-4708-bef2-6b5f5cafbdaa',
      subject: 'Template subject',
      body: '<b>Literal text</b>',
      version: 1,
      updatedAt: '2026-09-06T10:00:00.000Z',
    };
    const save = vi.fn().mockResolvedValue({ success: false, code: 'email_template.conflict' });
    const api = new EmailApiStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: IntegrationsApi, useValue: api },
        {
          provide: EmailTemplatesApi,
          useValue: { list: async () => ({ success: true, result: [template] }), save },
        },
      ],
    });
    const fixture = TestBed.createComponent(Emails);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const click = (pattern: RegExp) =>
      [...root.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => pattern.test(button.textContent ?? ''))
        ?.click();
    fill(root, '#email-recipient', 'recipient@example.test');
    fill(root, '#email-reference', 'FA-2026-000001');
    const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(true);
    await fixture.whenStable();
    click(/Utiliser ce modèle|Use this template/);
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.value).toBe(
      'recipient@example.test',
    );
    expect(root.querySelector<HTMLInputElement>('#email-reference')?.value).toBe('FA-2026-000001');
    expect(root.querySelector<HTMLTextAreaElement>('#email-body')?.value).toBe(template.body);
    confirmation.mockResolvedValue(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    confirmation.mockResolvedValue(true);
    fill(root, '#email-body', 'Edited template');
    await fixture.whenStable();
    click(/Mettre à jour le modèle|Update the open template/);
    await fixture.whenStable();
    expect(save).toHaveBeenCalledWith(template.id, {
      subject: template.subject,
      body: 'Edited template',
      expectedVersion: 1,
    });
    expect(root.querySelector<HTMLTextAreaElement>('#email-body')?.value).toBe('Edited template');
    expect(api.requests).toHaveLength(0);
    confirmation.mockRestore();
  });
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InvoiceReminder, useValue: { prepare: async () => undefined } },
        { provide: EmailDraftsApi, useValue: new DraftApiStub() },
        {
          provide: EmailTemplatesApi,
          useValue: { list: async () => ({ success: true, result: [] }) },
        },
      ],
    });
  });
  it('requires confirmation before discarding a prepared reminder without manual edits', async () => {
    const draft = {
      recipient: 'client@example.test',
      reference: 'FA-2026-000001',
      subject: 'Payment reminder',
      body: 'Remaining balance: €75.00',
    };
    const prepare = vi.fn().mockResolvedValue(draft);
    TestBed.configureTestingModule({
      providers: [
        { provide: IntegrationsApi, useValue: new EmailApiStub() },
        { provide: InvoiceReminder, useValue: { prepare } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ invoice: '01ARZ3NDEKTSV4RRFFQ69G5FAY' }),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(Emails);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.value).toBe(draft.recipient);
    const confirmation = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    expect(confirmation).toHaveBeenCalled();
    confirmation.mockRestore();
  });
  it('records a simulated email, preserves literal text, and clears the completed form', async () => {
    const api = new EmailApiStub();
    TestBed.configureTestingModule({ providers: [{ provide: IntegrationsApi, useValue: api }] });
    const fixture = TestBed.createComponent(Emails);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    compose(root);
    await fixture.whenStable();
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({
      kind: 'email',
      expectedMode: 'simulation',
      recipient: 'client@example.test',
      reference: 'DE-2026-000001',
    });
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.value).toBe('');
    expect(root.querySelector('.message-body')?.closest('li')?.textContent).toMatch(
      /non envoyé|not sent/,
    );
    expect(root.querySelector('.message-body')?.textContent).toContain('<script>alert(1)</script>');
    expect(root.querySelector('script')).toBeNull();
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('[role="status"]'));
  });
  it('locks an ambiguous request and retries without changing the key or losing the draft', async () => {
    const api = new EmailApiStub();
    api.fail = true;
    TestBed.configureTestingModule({ providers: [{ provide: IntegrationsApi, useValue: api }] });
    const fixture = TestBed.createComponent(Emails);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    compose(root);
    const confirm = vi.spyOn(Confirmation.prototype, 'request').mockResolvedValue(false);
    expect(await fixture.componentInstance.canDeactivate()).toBe(false);
    await fixture.whenStable();
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.disabled).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.value).toBe(
      'client@example.test',
    );
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    api.fail = false;
    root.querySelector<HTMLButtonElement>('form button[type="button"]')?.click();
    await fixture.whenStable();
    expect(api.requests).toHaveLength(2);
    expect(api.requests[1]).toEqual(api.requests[0]);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    confirm.mockRestore();
  });
  it('saves incomplete drafts, restores their text, and uses the saved identifier for submission', async () => {
    const drafts = new DraftApiStub();
    const api = new EmailApiStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: EmailDraftsApi, useValue: drafts },
        { provide: IntegrationsApi, useValue: api },
      ],
    });
    let fixture = TestBed.createComponent(Emails);
    await fixture.whenStable();
    let root: HTMLElement = fixture.nativeElement;
    fill(root, '#email-subject', 'Saved subject');
    await fixture.whenStable();
    [...root.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => /Enregistrer le brouillon|Save draft/.test(button.textContent ?? ''))
      ?.click();
    await fixture.whenStable();
    expect(drafts.items.size).toBe(1);
    expect(api.requests).toHaveLength(0);
    expect(await fixture.componentInstance.canDeactivate()).toBe(true);
    const id = [...drafts.items.keys()][0];
    fixture.destroy();
    fixture = TestBed.createComponent(Emails);
    await fixture.whenStable();
    root = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.drafts button')?.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#email-subject')?.value).toBe('Saved subject');
    compose(root);
    await fixture.whenStable();
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]?.requestId).toBe(id);
  });
});
import { Confirmation } from '@shared/confirmation/confirmation';
