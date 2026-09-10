import { operation, setupEmailPage } from './email-workspace.spec-helper';

describe('Emails', () => {
  it('keeps status filters and sort order in the URL and restores search focus after removal', async () => {
    const { root, router, harness } = await setupEmailPage(
      '/backoffice/courriels/messages?state=pending&sort=subject-desc',
    );
    expect(root.querySelector('app-empty-state')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('[appFilterChip]')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toContain('state=all');
    expect(router.url).toContain('sort=subject-desc');
    expect(document.activeElement).toBe(root.querySelector('input[type="search"]'));
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(root.querySelector('thead th')?.getAttribute('aria-sort')).toBe('descending');
  });
  it('separates four focused lists from their forms and full message text', async () => {
    const { root, harness, router } = await setupEmailPage('/backoffice/courriels/messages');
    expect(root.querySelector('form')).toBeNull();
    expect(root.querySelectorAll('app-tabs a')).toHaveLength(4);
    expect(root.querySelector('tbody')?.textContent).toContain(operation.request.subject);
    expect(root.textContent).not.toContain(operation.request.body);
    root.querySelector<HTMLAnchorElement>('#email-templates-tab')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/backoffice/courriels/templates');
    expect(root.querySelector('app-page-header a')?.getAttribute('href')).toContain(
      '/templates/new',
    );
    expect(root.querySelector('tbody a')?.getAttribute('href')).toContain('/edit');
  });
  it('preserves query state through a message detail and its return link', async () => {
    const { root, harness, router } = await setupEmailPage(
      '/backoffice/courriels/messages?q=facture',
    );
    root.querySelector<HTMLAnchorElement>('tbody a')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('.message-body')?.textContent).toContain('<b>Texte littéral</b>');
    expect(root.querySelector('.message-body b')).toBeNull();
    root.querySelector<HTMLAnchorElement>('.email-task > a')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toContain('/messages?q=facture');
    expect(root.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('facture');
  });
  it('distinguishes a failed list from an empty list without hiding other spaces', async () => {
    const { root, harness, api, router } = await setupEmailPage('/backoffice/courriels/templates');
    api.list.mockRejectedValue(new Error('unavailable'));
    await router.navigateByUrl('/other');
    await router.navigateByUrl('/backoffice/courriels/messages');
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(root.querySelector('app-empty-state')).toBeNull();
    root.querySelector<HTMLAnchorElement>('#email-templates-tab')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelectorAll('tbody tr')).toHaveLength(1);
  });
});
