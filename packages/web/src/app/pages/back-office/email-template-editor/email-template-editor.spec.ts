import { EmailTemplateEditor } from './email-template-editor';
import { emailTemplateId, setupEmailPage } from '../emails/email-workspace.spec-helper';

describe('EmailTemplateEditor', () => {
  it('edits templates independently and preserves version conflicts', async () => {
    const { root, fill, save, templates, api, harness } = await setupEmailPage(
      `/backoffice/emails/templates/${emailTemplateId}/edit`,
    );
    templates.save.mockResolvedValue({ success: false, code: 'email_template.conflict' });
    await fill('template-body', 'Changed shared text');
    await save();
    expect(templates.save).toHaveBeenCalledWith(
      emailTemplateId,
      expect.objectContaining({ expectedVersion: 3, body: 'Changed shared text' }),
    );
    expect(root.querySelector<HTMLTextAreaElement>('#template-body')?.value).toBe(
      'Changed shared text',
    );
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(api.submit).not.toHaveBeenCalled();
    expect(
      await (harness.routeDebugElement!.componentInstance as EmailTemplateEditor).canDeactivate(),
    ).toBe(false);
  });
  it('keeps the creation key after failure and never requires a recipient', async () => {
    const { root, fill, save, templates, router } = await setupEmailPage(
      '/backoffice/emails/templates/new',
    );
    templates.save.mockResolvedValueOnce({ success: false, code: 'emailTemplate.error' });
    await save();
    expect(document.activeElement?.id).toBe('template-subject');
    await fill('template-subject', 'New template');
    await fill('template-body', 'Text');
    await save();
    await save();
    expect(templates.save.mock.calls[0]?.[0]).toBe(templates.save.mock.calls[1]?.[0]);
    expect(root.querySelector('#email-recipient')).toBeNull();
    expect(router.url).toContain('/templates');
  });
  it('requires confirmation before archiving and preserves errors', async () => {
    const { templates, confirmation, harness, root } = await setupEmailPage(
      `/backoffice/emails/templates/${emailTemplateId}/edit`,
    );
    const component = harness.routeDebugElement!.componentInstance as EmailTemplateEditor;
    await component['archive']();
    expect(templates.archive).not.toHaveBeenCalled();
    confirmation.request.mockResolvedValue(true);
    templates.archive.mockResolvedValue({ success: false, code: 'email_template.conflict' });
    await component['archive']();
    await harness.fixture.whenStable();
    expect(root.querySelector('form')).not.toBeNull();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });
});
