import { EmailComposer } from './email-composer';
import {
  emailDraftId,
  emailTemplateId,
  invoiceId,
  operation,
  setupEmailPage,
} from '../emails/email-workspace.spec-helper';

describe('EmailComposer', () => {
  it('keeps completed writes locked when destination navigation is refused', async () => {
    const { navigation, drafts, fill, harness, root } = await setupEmailPage(
      '/backoffice/courriels/new',
    );
    await fill('email-subject', 'Saved draft');
    navigation.allowList = false;
    const component = harness.routeDebugElement!.componentInstance as EmailComposer;
    await component['saveDraft']();
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    await component['saveDraft']();
    expect(drafts.save).toHaveBeenCalledTimes(1);
    expect(await component.canDeactivate()).toBe(true);
  });
  it('blocks submission when stored recovery data is malformed', async () => {
    const { root, router, harness, api, drafts } = await setupEmailPage('/other');
    sessionStorage.setItem('test.email-message', '{"requestId":"invalid"}');
    await router.navigateByUrl('/backoffice/courriels/new');
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(api.submit).not.toHaveBeenCalled();
    expect(drafts.save).not.toHaveBeenCalled();
  });
  it('never turns a missing draft into a creation form', async () => {
    const { root } = await setupEmailPage(`/backoffice/courriels/drafts/${emailDraftId}/edit`);
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('validates submission without disabling its button and saves incomplete drafts separately', async () => {
    const { root, save, fill, drafts, api, router, harness } = await setupEmailPage(
      '/backoffice/courriels/new',
    );
    expect(
      root.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled,
      root.textContent,
    ).toBe(false);
    await save();
    expect(document.activeElement?.id).toBe('email-recipient');
    expect(api.submit).not.toHaveBeenCalled();
    await fill('email-subject', 'Incomplete draft');
    const component = harness.routeDebugElement!.componentInstance as EmailComposer;
    await component['saveDraft']();
    await harness.fixture.whenStable();
    expect(drafts.save).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        subject: 'Incomplete draft',
        recipient: '',
        body: '',
        expectedVersion: 0,
      }),
    );
    expect(router.url).toContain('/drafts');
    expect(api.submit).not.toHaveBeenCalled();
  });
  it('copies template text without changing recipients or writing a shared template', async () => {
    const { root, fill, harness, templates, confirmation } = await setupEmailPage(
      '/backoffice/courriels/new',
    );
    const component = harness.routeDebugElement!.componentInstance as EmailComposer;
    await fill('email-recipient', 'recipient@example.test');
    await fill('email-reference', 'DE-2026-000001');
    await component['applyTemplate'](emailTemplateId);
    await harness.fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.value).toBe(
      'recipient@example.test',
    );
    expect(root.querySelector<HTMLInputElement>('#email-reference')?.value).toBe('DE-2026-000001');
    expect(root.querySelector<HTMLTextAreaElement>('#email-body')?.value).toBe(
      '<b>Texte du modèle</b>',
    );
    expect(templates.save).not.toHaveBeenCalled();
    expect(await component.canDeactivate()).toBe(false);
    expect(confirmation.request).toHaveBeenCalled();
  });
  it('keeps uncertain requests across route recreation and retries the same content and identifier', async () => {
    const { root, fill, save, api, store, router, confirmation, harness } = await setupEmailPage(
      '/backoffice/courriels/new',
    );
    api.submit.mockResolvedValueOnce({ success: false, code: 'integrations.error' });
    api.list.mockResolvedValue([]);
    await fill('email-recipient', 'client@example.test');
    await fill('email-reference', 'DE-2026-000001');
    await fill('email-subject', 'Proposition');
    await fill('email-body', '<script>Literal text</script>');
    await save();
    expect(root.querySelector<HTMLInputElement>('#email-recipient')?.disabled).toBe(true);
    const pending = store.read();
    expect(pending?.body).toBe('<script>Literal text</script>');
    confirmation.request.mockResolvedValue(true);
    await router.navigateByUrl('/other');
    await router.navigateByUrl('/backoffice/courriels/new');
    await harness.fixture.whenStable();
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(root.querySelector<HTMLTextAreaElement>('#email-body')?.value).toBe(pending?.body);
    const component = harness.routeDebugElement!.componentInstance as EmailComposer;
    await component['retry']();
    await harness.fixture.whenStable();
    expect(api.submit).toHaveBeenCalledTimes(2);
    expect(api.submit.mock.calls[1]?.[0]).toEqual(api.submit.mock.calls[0]?.[0]);
    expect(store.read()).toBeUndefined();
    expect(router.url).toContain('/messages/');
  });
  it('reconciles confirmed requests without resubmitting them', async () => {
    const { store, api, router, harness, root } = await setupEmailPage('/other');
    store.write(operation.request);
    await router.navigateByUrl('/backoffice/courriels/new');
    await harness.fixture.whenStable();
    expect(store.read()).toBeUndefined();
    expect(api.submit).not.toHaveBeenCalled();
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelector('[role="status"]')).not.toBeNull();
  });
  it('preserves draft version conflicts and does not submit after a failed draft save', async () => {
    const { draftItems, drafts, api, router, harness, fill, save, root } =
      await setupEmailPage('/other');
    draftItems.set(emailDraftId, {
      id: emailDraftId,
      recipient: operation.request.recipient,
      reference: operation.request.reference,
      subject: operation.request.subject,
      body: operation.request.body,
      reminder: false,
      version: 3,
      updatedAt: operation.createdAt,
    });
    await router.navigateByUrl(`/backoffice/courriels/drafts/${emailDraftId}/edit`);
    await harness.fixture.whenStable();
    drafts.save.mockResolvedValue({ success: false, code: 'email_draft.conflict' });
    await fill('email-body', 'Unsaved text');
    await save();
    expect(drafts.save).toHaveBeenCalledWith(
      emailDraftId,
      expect.objectContaining({ expectedVersion: 3 }),
    );
    expect(api.submit).not.toHaveBeenCalled();
    expect(root.querySelector<HTMLTextAreaElement>('#email-body')?.value).toBe('Unsaved text');
  });
  it('guards prepared reminders even before manual edits', async () => {
    const { harness, root } = await setupEmailPage(
      `/backoffice/courriels/new?invoice=${invoiceId}`,
    );
    const component = harness.routeDebugElement!.componentInstance as EmailComposer;
    expect(root.querySelector<HTMLInputElement>('#email-reference')?.value).toBe(
      operation.request.reference,
    );
    expect(await component.canDeactivate()).toBe(false);
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
