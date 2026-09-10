import { operation, setupEmailPage } from './email-workspace.spec-helper';
import { Emails } from './emails';
import { installScrollIntoView } from '@shared/filter-choice/filter-choice.spec-helper';

describe('Emails', () => {
  it('opens one filter panel at a time and commits only a selected state', async () => {
    const scrolling = installScrollIntoView();
    try {
      const { root, harness, router } = await setupEmailPage('/backoffice/courriels/messages');
      const trigger = root.querySelector<HTMLButtonElement>('app-filter-menu > button')!;
      trigger.click();
      await harness.fixture.whenStable();
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
      expect(dialog.querySelectorAll('[role="menuitem"]')).toHaveLength(2);
      expect(dialog.querySelector('input')).toBeNull();
      dialog.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();
      await harness.fixture.whenStable();
      const search = dialog.querySelector<HTMLInputElement>('[role="combobox"]')!;
      expect(document.activeElement).toBe(search);
      expect(dialog.querySelector('input[type="date"]')).toBeNull();
      search.value = 'confirm';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await harness.fixture.whenStable();
      expect(dialog.querySelectorAll('[role="option"]')).toHaveLength(1);
      expect(router.url).not.toContain('state=pending');
      dialog.querySelector<HTMLElement>('[role="option"]')!.click();
      await harness.fixture.whenStable();
      expect(router.url).toContain('state=pending');
      expect(document.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(trigger);
      expect(root.querySelector('app-empty-state')).not.toBeNull();
    } finally {
      scrolling.restore();
    }
  });
  it('exports only filtered list metadata and retains date and recipient sort on return', async () => {
    const { root, harness, router } = await setupEmailPage(
      '/backoffice/courriels/messages?from=2026-01-01&to=2026-12-31&sort=recipient-desc',
    );
    const page = harness.routeDebugElement!.componentInstance as Emails;
    const rows = page['exportRows']('messages');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(operation.request.subject);
    expect(rows[0]).not.toContain(operation.request.body);
    expect(root.querySelector('app-table-export')).not.toBeNull();
    expect(root.querySelectorAll('[appFilterChip]')).toHaveLength(2);
    root.querySelector<HTMLAnchorElement>('tbody a')!.click();
    await harness.fixture.whenStable();
    expect(router.url).toContain('sort=recipient-desc');
    expect(router.url).toContain('from=2026-01-01');
    root.querySelector<HTMLAnchorElement>('.email-task > a')!.click();
    await harness.fixture.whenStable();
    expect(root.querySelector('thead th:nth-child(2)')?.getAttribute('aria-sort')).toBe(
      'descending',
    );
  });
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
