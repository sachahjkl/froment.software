import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  IntegrationStatusList,
  type IntegrationOperationValue,
  type IntegrationSubmissionValue,
} from '@froment/contracts';
import { IntegrationsApi } from '@backoffice/integrations-api';
import { Integrations } from './integrations';

class IntegrationsApiStub {
  async retries() {
    return [];
  }
  readonly requests: IntegrationSubmissionValue[] = [];
  unavailable = false;
  failSubmission = false;
  async status(): Promise<typeof IntegrationStatusList.Type> {
    if (this.unavailable) throw new Error('integration.unavailable');
    return [
      { kind: 'email', mode: 'simulation' },
      { kind: 'payment', mode: 'simulation' },
    ];
  }
  async list(): Promise<ReadonlyArray<IntegrationOperationValue>> {
    return [];
  }
  async submit(request: IntegrationSubmissionValue) {
    this.requests.push(request);
    if (this.failSubmission)
      return { success: false as const, code: 'integrations.error' as const };
    return {
      success: true as const,
      result: {
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        request,
        receipt: {
          id: `simulation:${request.requestId}`,
          mode: 'simulation' as const,
          status: 'simulated' as const,
        },
        createdAt: '2026-09-06T10:00:00.000Z',
        createdByUserId: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
      },
    };
  }
}

describe('Integrations', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  it('labels simulations, records a test and focuses the result without claiming delivery', async () => {
    const api = new IntegrationsApiStub();
    TestBed.configureTestingModule({ providers: [{ provide: IntegrationsApi, useValue: api }] });
    const fixture = TestBed.createComponent(Integrations);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.textContent).toMatch(/production/);
    root.querySelector<HTMLButtonElement>('.providers button')?.click();
    await fixture.whenStable();
    expect(api.requests).toHaveLength(1);
    expect(api.requests[0]).toMatchObject({
      kind: 'email',
      expectedMode: 'simulation',
      recipient: 'simulation@example.test',
    });
    expect(root.querySelectorAll('.operations li')).toHaveLength(1);
    expect(root.querySelector('.operations')?.textContent).toMatch(
      /aucune opération réelle|no real operation/,
    );
    expect(document.activeElement).toBe(root.querySelector('[role="status"]'));
  });
  it('keeps the request key after failure and provides a reload action', async () => {
    const api = new IntegrationsApiStub();
    api.failSubmission = true;
    TestBed.configureTestingModule({ providers: [{ provide: IntegrationsApi, useValue: api }] });
    const fixture = TestBed.createComponent(Integrations);
    await fixture.whenStable();
    await fixture.componentInstance.load();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    root.querySelector<HTMLButtonElement>('.providers button')?.click();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    api.failSubmission = false;
    root.querySelector<HTMLButtonElement>('.providers button')?.click();
    await fixture.whenStable();
    expect(api.requests).toHaveLength(2);
    expect(api.requests[1]).toEqual(api.requests[0]);
    api.unavailable = true;
    await fixture.componentInstance.load();
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
});
