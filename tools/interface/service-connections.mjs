import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId } from "./fixtures.mjs";
import { checkCheckout } from "./checkout.mjs";
import {
  checkColumnSort,
  checkEmptyExport,
  chooseWorkspaceFilter,
  readTableCsv,
} from "./configuration-workspace.mjs";

export async function checkServiceConnections(page, testInfo) {
  await page.goto("/backoffice/services");
  await expect(page.locator("app-connections")).toHaveClass(/page-container/);
  await expect(page.locator("app-configuration")).toHaveCount(0);
  await expect(page.locator("app-connections tbody tr")).toHaveCount(4);
  await expect(page.locator("app-connections")).toContainText(
    /Présents sur le serveur|Present on the server/,
  );
  await page.screenshot({ path: testInfo.outputPath("service-connections.png"), fullPage: true });
  let operation;
  let status = "queued";
  let unavailable = false;
  let writes = 0;
  let loseResponse = false;
  let hideOperation = false;
  const requests = [];
  await page.route("**/api/integrations/email-tests", async (route) => {
    if (unavailable) return route.fulfill({ status: 503, json: {} });
    if (route.request().method() === "POST") {
      writes++;
      status = "queued";
      const request = route.request().postDataJSON();
      requests.push(request);
      expect(Object.keys(request).sort()).toEqual(["body", "requestId", "subject"]);
      operation = {
        request,
        createdByUserId: clientId,
        createdAt: "2026-09-09T12:00:00.000Z",
        updatedAt: "2026-09-09T12:00:00.000Z",
        status,
        attempts: 0,
        nextAttemptAt: "2026-09-09T12:00:03.000Z",
        providerId: null,
        error: null,
      };
      hideOperation = loseResponse;
      return loseResponse ? route.abort("failed") : route.fulfill({ json: operation });
    }
    return route.fulfill({
      json:
        operation && !hideOperation
          ? [
              {
                ...operation,
                status,
                attempts: status === "queued" ? 0 : 1,
                providerId: status === "queued" ? null : "13d1635c-64c8-4078-b0f5-d936fb3791dd",
                nextAttemptAt: status === "delivered" ? null : operation.nextAttemptAt,
              },
            ]
          : [],
    });
  });
  await page.locator('app-connections a[href="/backoffice/services/resend"]').click();
  await expect(page.locator("app-provider-connection form")).toHaveCount(0);
  await page.locator('app-provider-connection a[href$="/resend/tests"]').click();
  await expect(page.locator("app-email-test-list form")).toHaveCount(0);
  await expect(page.locator("app-email-test-list tbody")).toContainText(/Aucun test|No test/);
  await checkEmptyExport(page, page.locator("app-email-test-list app-table-export"));
  expect(writes).toBe(0);
  await page.locator('app-email-test-list a[href$="/tests/new"]').click();
  await expect(page).toHaveURL(/\/backoffice\/services\/resend\/tests\/new$/);
  await expect(page.locator("#main-content")).toBeFocused();
  const form = page.locator("app-email-test");
  await expect(form).toHaveClass(/page-container/);
  await expect(form).toContainText("sacha@sacha.house");
  await expect(form).toContainText("sacha@froment.software");
  const subject = page.locator("#email-test-subject");
  expect(await subject.evaluate((input) => getComputedStyle(input).borderRadius)).not.toBe("0px");
  await subject.fill("");
  await form.getByRole("button", { name: /Envoyer le test|Send test email/, exact: true }).click();
  await expect(subject).toBeFocused();
  await expect(subject).toHaveAttribute("aria-invalid", "true");
  await subject.fill("Vérification de la messagerie / Email connection check");
  await page
    .locator("#email-test-body")
    .fill("Bonjour Sacha,\n\nVoici un test de messagerie.\nIl ne déclenche aucune relance client.");
  await expect(form.locator(".message-preview").first()).toContainText("Bonjour Sacha");
  await form.locator('a[href="/backoffice/services/resend/tests"]').click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/services\/resend\/tests\/new$/);
  await form.getByRole("button", { name: /Envoyer le test|Send test email/, exact: true }).click();
  await expect(page.getByRole("alertdialog")).toContainText("sacha@sacha.house");
  await page.keyboard.press("Escape");
  expect(writes).toBe(0);
  await form.getByRole("button", { name: /Envoyer le test|Send test email/, exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Envoyer le test|Send test email/ })
    .click();
  await expect(form.getByRole("status")).toContainText(/Enregistré|Recorded/);
  await expect(form.getByRole("status")).toBeFocused();
  expect(writes).toBe(1);
  expect(requests[0].requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  await expect(form.locator("form")).toHaveCount(0);
  await form.locator(`a[href$="/tests/${requests[0].requestId}"]`).click();
  const detail = page.locator("app-email-test-detail");
  await expect(detail.locator("form")).toHaveCount(0);
  status = "accepted";
  await expect(detail.getByRole("status")).toContainText(
    /remise non confirmée|delivery unconfirmed/,
    { timeout: 10000 },
  );
  status = "delivered";
  await expect(detail.getByRole("status")).toContainText(/Remise confirmée|Delivery confirmed/, {
    timeout: 10000,
  });
  unavailable = true;
  await expect(detail).toContainText(/Suivi suspendu|Status refresh paused/, { timeout: 10000 });
  await expect(detail.getByRole("status")).toContainText(/Remise confirmée|Delivery confirmed/);
  unavailable = false;
  await detail.getByRole("button", { name: /Actualiser le suivi|Refresh test status/ }).click();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.screenshot({ path: testInfo.outputPath(`resend-${theme}.png`), fullPage: true });
  }
  loseResponse = true;
  await detail.locator('a[href="/backoffice/services/resend/tests"]').click();
  await expect(page.locator("app-email-test-list tbody a")).toHaveCount(1);
  await page.locator('app-email-test-list a[href$="/tests/new"]').click();
  await subject.fill("Vérification de la messagerie / Email connection check");
  await page
    .locator("#email-test-body")
    .fill("Reprise contrôlée de cette demande de démonstration.");
  await form.getByRole("button", { name: /Envoyer le test|Send test email/, exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Envoyer le test|Send test email/ })
    .click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(subject).toHaveAttribute("readonly", "");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(subject).toHaveValue("Vérification de la messagerie / Email connection check");
  await expect(subject).toHaveAttribute("readonly", "");
  expect(writes).toBe(2);
  expect(requests[1].requestId).not.toBe(requests[0].requestId);
  const pending = await page.evaluate(() =>
    Object.entries(sessionStorage).filter(([key]) => key.startsWith("froment.pending.email-test.")),
  );
  expect(pending).toHaveLength(1);
  expect(JSON.parse(pending[0][1])).toEqual(requests[1]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/backoffice/services/resend/tests");
  await expect(page.locator("app-email-test-list form")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) =>
        key.startsWith("froment.pending.email-test."),
      ),
    ),
  ).toEqual(pending);
  expect(writes).toBe(2);
  await page.locator('app-email-test-list a[href$="/tests/new"]').click();
  await expect(subject).toHaveAttribute("readonly", "");
  loseResponse = false;
  await form
    .getByRole("button", { name: /Reprendre la même demande|Resume the same request/ })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Envoyer le test|Send test email/ })
    .click();
  await expect(form.getByRole("status")).toContainText(/Enregistré|Recorded/);
  expect(writes).toBe(3);
  expect(requests[1]).toEqual(requests[2]);
  await form.locator('a[href="/backoffice/services/resend/tests"]').click();
  await expect(page).toHaveURL(/\/backoffice\/services\/resend\/tests$/);
  const list = page.locator("app-email-test-list");
  await chooseWorkspaceFilter(
    page,
    list.locator("app-filter-menu"),
    /État|Status|status/,
    /Test arrêté après une erreur|Test stopped after an error/,
  );
  await checkEmptyExport(page, list.locator("app-table-export"));
  await chooseWorkspaceFilter(
    page,
    list.locator("app-filter-menu"),
    /État|Status|status/,
    /Toutes les lignes|All rows/,
  );
  await checkColumnSort(page, list.locator("table"), 1, "ascending", "sort", "subjectAsc");
  await checkColumnSort(
    page,
    list.locator("table"),
    1,
    "descending",
    "sort",
    "subjectDesc",
    "Space",
  );
  await list.locator("app-list-search input").fill("mesagerie");
  await expect(list.locator("tbody a")).toHaveCount(1);
  const csv = await readTableCsv(page, list.locator("app-table-export"), "resend-tests.csv");
  expect(csv).toContain(requests[2].subject);
  expect(csv).not.toContain(requests[2].body);
  expect(csv).not.toContain(requests[2].requestId);
  expect(csv).not.toContain(clientId);
  await list.locator("tbody a").click();
  expect(new URL(page.url()).searchParams.get("sort")).toBe("subjectDesc");
  await detail.locator('a[href^="/backoffice/services/resend/tests"]').click();
  await expect(list.locator("app-list-search input")).toHaveValue("mesagerie");
  await list.locator('a[href*="/tests/new"]').click();
  await expect(subject).toBeEditable();
  await form.locator('a[href^="/backoffice/services/resend/tests"]').click();
  await expect(list.locator('th[aria-sort="descending"]')).toHaveCount(1);
  await list.locator("nav a").first().click();
  await page.locator('app-provider-connection a[href*="/resend/tests"]').click();
  await expect(list.locator("app-list-search input")).toHaveValue("mesagerie");
  expect(writes).toBe(3);
  await checkCheckout(page, testInfo);
  await page.goto("/backoffice/services/simulations");
  await expect(page.locator("app-integrations")).toHaveClass(/page-container/);
  await expect(page.locator("app-integrations form select option")).toHaveCount(6);
}
