import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { InvoiceReminder } from '@backoffice/invoice-reminder';
import { vi } from 'vitest';
import {
  type IntegrationOperationValue,
  type IntegrationSubmissionValue,
} from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { Emails } from './emails';

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
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: InvoiceReminder, useValue: { prepare: async () => undefined } },
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
    expect(root.querySelector('li')?.textContent).toMatch(/non envoyé|not sent/);
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
});
import { Confirmation } from '@shared/confirmation/confirmation';
