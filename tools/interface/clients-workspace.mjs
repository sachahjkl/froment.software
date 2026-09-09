import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { client, clientId, invoiceId, quoteId } from "./fixtures.mjs";
import { openBackOfficeNavigation } from "./dashboard-shell.mjs";

export async function checkClientsWorkspace(page, testInfo) {
  const createdId = "01ARZ3NDEKTSV4RRFFQ69G5FB0";
  let records = [client];
  let releaseList;
  let failList = true;
  let conflict = true;
  let creationCount = 0;
  let updatedRequest;
  let logoutRequests = 0;
  const listPattern = "**/api/clients";
  const detailPattern = /\/api\/clients\/[A-Z0-9]+$/;
  const actionPattern = /\/api\/clients\/[A-Z0-9]+\/(archive|reactivate|access)$/;
  const logoutPattern = "**/api/auth/logout";
  await page.route(logoutPattern, (route) => {
    logoutRequests++;
    return logoutRequests === 1
      ? route.fulfill({ status: 503, json: { code: "authentication.error" } })
      : route.fulfill({ status: 204 });
  });
  await page.route(listPattern, async (route) => {
    if (route.request().method() === "POST") {
      creationCount++;
      const created = {
        ...route.request().postDataJSON(),
        id: createdId,
        archived: false,
        updatedAt: 42,
      };
      records = [...records, created];
      return route.fulfill({ json: created });
    }
    if (failList) {
      await new Promise((resolve) => {
        releaseList = resolve;
      });
      return route.fulfill({ status: 503, json: { code: "client.error" } });
    }
    return route.fulfill({ json: records });
  });
  await page.route(detailPattern, async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    let record = records.find((item) => item.id === id);
    if (route.request().method() === "PUT") {
      updatedRequest = route.request().postDataJSON();
      if (conflict)
        return route.fulfill({
          status: 409,
          json: { _tag: "ClientVersionConflict", code: "client.version_conflict" },
        });
      const { expectedUpdatedAt, ...fields } = updatedRequest;
      expect(expectedUpdatedAt).toBe(record.updatedAt);
      record = { ...record, ...fields, updatedAt: record.updatedAt + 1 };
      records = records.map((item) => (item.id === id ? record : item));
    }
    return route.fulfill({ json: record });
  });
  await page.route(actionPattern, async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const action = parts.at(-1);
    if (action === "access") return route.fulfill({ json: [] });
    const id = parts.at(-2);
    records = records.map((record) =>
      record.id === id ? { ...record, archived: action === "archive" } : record,
    );
    return route.fulfill({ json: records.find((record) => record.id === id) });
  });
  try {
    await page.goto("/backoffice/clients");
    await expect(page.locator('app-clients [role="status"]')).toContainText(/Loading|Chargement/);
    await page.screenshot({ path: testInfo.outputPath("clients-loading.png"), fullPage: true });
    releaseList();
    await expect(page.locator('app-clients [role="alert"]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("clients-error.png"), fullPage: true });
    failList = false;
    await page
      .locator("app-clients")
      .getByRole("button", { name: /Retry|Réessayer/ })
      .click();
    await expect(page.locator("app-clients tbody tr")).toHaveCount(1);
    await page.locator("#clients-search").fill("developement");
    await expect(page.locator("app-clients tbody tr")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(page.locator("app-clients tbody th")).toHaveCSS("text-transform", "none");
    if (page.viewportSize().width >= 1024) {
      expect(
        await page
          .locator("app-clients [appDataTable]")
          .evaluate((node) => node.scrollWidth > node.clientWidth),
      ).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath("clients-list.png"), fullPage: true });
    const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme === "dark" ? "light" : "dark";
    }, originalTheme);
    await page.screenshot({
      path: testInfo.outputPath("clients-list-other-theme.png"),
      fullPage: true,
    });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, originalTheme);
    await page.locator("#clients-search").fill("zzzzzzzz");
    await expect(page.locator("app-empty-state")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("clients-empty.png"), fullPage: true });
    await page.locator("app-clients app-page-header a").click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(page.locator("app-client-editor")).toBeVisible();
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page.locator("#client-displayName")).toHaveAttribute("aria-invalid", "true");
    await page.locator("#client-displayName").fill("Client de démonstration");
    await page.locator("#client-email").fill("client@example.test");
    await page.locator("app-client-editor .actions a").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#client-displayName")).toHaveValue("Client de démonstration");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("client-create.png"), fullPage: true });
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/profile$`));
    expect(creationCount).toBe(1);
    await expect(page.locator("app-client-detail form")).toHaveCount(0);
    await expect(page.locator("app-client-detail .profile")).toContainText("client@example.test");
    await page.locator("app-client-detail app-page-header a").click();
    await page.locator("#client-city").fill("Lyon");
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page.locator('app-client-editor [role="alert"]')).toContainText(
      /elsewhere|ailleurs/,
    );
    await expect(page.locator("#client-city")).toHaveValue("Lyon");
    expect(updatedRequest.expectedUpdatedAt).toBe(42);
    conflict = false;
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page.locator("app-client-detail .profile")).toContainText("Lyon");
    await page.locator(".client-actions summary").click();
    await page.locator(".client-actions button").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Confirm|Confirmer)$/ })
      .click();
    await expect(page.locator(".archived-notice")).toBeVisible();
    await page.locator(".archived-notice button").click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/access$`));
    await page.goto(`/backoffice/clients/${clientId}/profile`);
    await expect(page.locator("app-client-detail h1")).toHaveText(client.displayName);
    await page.evaluate(() => window.scrollTo(0, 0));
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("client-profile.png"), fullPage: true });
    await page.locator("#client-documents-tab").click();
    await expect(page.locator(`.documents a[href="/backoffice/quotes/${quoteId}"]`)).toBeVisible();
    await expect(
      page.locator(`.documents a[href="/backoffice/invoices/${invoiceId}"]`),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("client-documents.png"), fullPage: true });
    await page.goto("/design/data");
    await page.waitForLoadState("networkidle");
    await page.locator('app-list-toolbar input[type="search"]').fill("Angular");
    await expect(page.locator("#design-data-panel tbody tr")).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath("design-table.png"), fullPage: true });
    await page.goto("/design/feedback");
    await expect(page.locator("app-empty-state")).toBeVisible();
    await page.goto("/design/navigation");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Open navigation drawer|Ouvrir le tiroir/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`/backoffice/clients/${clientId}/edit`);
    await page.locator("#client-city").fill("Saisie conservée");
    await openBackOfficeNavigation(page);
    await page.locator(".account summary:visible").click();
    await page.locator(".sign-out:visible").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(logoutRequests).toBe(0);
    await expect(page.locator("#client-city")).toHaveValue("Saisie conservée");
    await page.locator(".sign-out:visible").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Confirm|Confirmer)$/ })
      .click();
    await expect(page.locator('app-sign-out [role="alert"]')).toBeVisible();
    expect(logoutRequests).toBe(1);
    await page.screenshot({ path: testInfo.outputPath("sign-out-error.png"), fullPage: true });
    await page.locator("app-sign-out button").click();
    await expect(page).toHaveURL(/\/backoffice\/login$/);
    expect(logoutRequests).toBe(2);
  } finally {
    await page.unroute(listPattern);
    await page.unroute(detailPattern);
    await page.unroute(actionPattern);
    await page.unroute(logoutPattern);
  }
}
