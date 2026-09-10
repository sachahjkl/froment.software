import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId, invoiceId, issuedInvoice } from "./fixtures.mjs";
import {
  checkColumnSort,
  checkEmptyExport,
  chooseWorkspaceFilter,
  readTableCsv,
} from "./configuration-workspace.mjs";

export async function checkCheckout(page, testInfo) {
  const invoice = {
    ...issuedInvoice,
    clientDisplayName: "Client du test",
    recordedPaidCents: 10000,
    totalCents: 360000,
    currency: "EUR",
    dueDate: "2026-10-05",
    title: "Test",
    updatedAt: "2026-09-09T12:00:00.000Z",
  };
  let empty = true;
  let operation;
  let status = "queued";
  let lostResponse = true;
  let readsUnavailable = false;
  const writes = [];
  await page.route("**/api/invoices", (route) => route.fulfill({ json: empty ? [] : [invoice] }));
  await page.route("**/api/integrations/checkout/connection", (route) =>
    route.fulfill({ json: { credentialsPresent: true, testKey: true, webhookConfigured: false } }),
  );
  await page.route("**/api/integrations/checkout", async (route) => {
    if (route.request().method() === "POST") {
      const request = route.request().postDataJSON();
      writes.push(request);
      expect(Object.keys(request).sort()).toEqual(["expectedVersion", "invoiceId", "requestId"]);
      if (lostResponse) return route.abort("failed");
      operation = {
        request,
        invoiceNumber: invoice.invoiceNumber,
        revisionId: issuedInvoice.currentRevision.id,
        amountCents: 350000,
        currency: "EUR",
        mode: "test",
        createdByUserId: clientId,
        createdAt: "2026-09-09T12:00:00.000Z",
        updatedAt: "2026-09-09T12:00:00.000Z",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        status,
        attempts: 0,
        nextAttemptAt: "2026-09-09T12:00:03.000Z",
        sessionId: null,
        checkoutUrl: null,
        error: null,
      };
      return route.fulfill({ json: operation });
    }
    if (readsUnavailable) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({
      json: operation
        ? [
            {
              ...operation,
              status,
              attempts: status === "queued" ? 0 : 1,
              sessionId: status === "queued" ? null : "cs_test_example",
              checkoutUrl:
                status === "open" ? "https://checkout.stripe.com/c/pay/cs_test_example" : null,
              nextAttemptAt: status === "paid" ? null : operation.nextAttemptAt,
            },
          ]
        : [],
    });
  });
  await page.goto("/backoffice/services/stripe");
  await expect(page.locator("app-provider-connection form")).toHaveCount(0);
  await page.locator('app-provider-connection a[href$="/stripe/tests"]').click();
  await expect(page.locator("app-checkout-list form")).toHaveCount(0);
  await expect(page.locator("app-checkout-list tbody")).toContainText(/Aucun test|No test/);
  await checkEmptyExport(page, page.locator("app-checkout-list app-table-export"));
  expect(writes).toHaveLength(0);
  await page.locator('app-checkout-list a[href$="/tests/new"]').click();
  await expect(page).toHaveURL(/\/backoffice\/services\/stripe\/tests\/new$/);
  const panel = page.locator("app-checkout");
  await expect(panel).toHaveClass(/page-container/);
  await expect(panel).toContainText(/Aucune facture éligible|No eligible invoice/);
  await expect(panel).toContainText(/Secret de signature absent|Signing secret absent/);
  empty = false;
  await panel.getByRole("button", { name: /Actualiser les accès|Refresh access/ }).click();
  await panel.getByRole("button", { name: /Créer la page de test|Create test page/ }).click();
  const field = panel.locator("app-object-picker > button");
  await expect(field).toBeFocused();
  await expect(page.locator("#checkout-invoice-error")).not.toBeEmpty();
  await field.click();
  await page.getByRole("dialog").locator('input[type="search"]').fill(invoice.invoiceNumber);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(invoice.invoiceNumber) })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(panel).toContainText(/3[\s\u202f\u00a0,]?500[,.]00/);
  await panel.locator('a[href="/backoffice/services/stripe/tests"]').click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await panel.getByRole("button", { name: /Créer la page de test|Create test page/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  expect(writes).toHaveLength(0);
  await panel.getByRole("button", { name: /Créer la page de test|Create test page/ }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Créer la page de test|Create test page/ })
    .click();
  await expect(panel.getByRole("alert")).toContainText(/réponse du serveur|server response/);
  await expect(field).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(panel.locator("form dl")).toContainText(invoice.invoiceNumber);
  await expect(field).toBeDisabled();
  expect(writes).toHaveLength(1);
  expect(writes[0].invoiceId).toBe(invoiceId);
  expect(writes[0].requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  const pending = await page.evaluate(() =>
    Object.entries(sessionStorage).filter(([key]) => key.startsWith("froment.pending.checkout.")),
  );
  expect(pending).toHaveLength(1);
  expect(JSON.parse(pending[0][1])).toEqual(writes[0]);
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/backoffice/services/stripe/tests");
  await expect(page.locator("app-checkout-list form")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.entries(sessionStorage).filter(([key]) => key.startsWith("froment.pending.checkout.")),
    ),
  ).toEqual(pending);
  expect(writes).toHaveLength(1);
  await page.locator('app-checkout-list a[href$="/tests/new"]').click();
  await expect(field).toBeDisabled();
  lostResponse = false;
  await panel
    .getByRole("button", { name: /Reprendre la même demande|Resume the same request/ })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Créer la page de test|Create test page/ })
    .click();
  await expect(panel.getByRole("status")).toContainText(/Demande enregistrée|Request recorded/);
  expect(writes).toHaveLength(2);
  expect(writes[0]).toEqual(writes[1]);
  await expect(panel.locator("form")).toHaveCount(0);
  await panel.locator(`a[href$="/tests/${writes[0].requestId}"]`).click();
  const detail = page.locator("app-checkout-detail");
  await expect(detail.locator("form")).toHaveCount(0);
  status = "open";
  const stripeLink = detail.getByRole("link", { name: /Ouvrir Stripe|Open Stripe/ });
  await expect(stripeLink).toBeVisible({ timeout: 10000 });
  await expect(stripeLink).toHaveAttribute("target", "_blank");
  await expect(stripeLink).toHaveAttribute("data-button-variant", "primary");
  await expect(detail.getByRole("status")).toContainText(
    /paiement non confirmé|payment unconfirmed/,
  );
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    await stripeLink.focus();
    await page.screenshot({ path: testInfo.outputPath(`checkout-${theme}.png`), fullPage: true });
  }
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: 320, height: 860 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("checkout-320.png"), fullPage: true });
  await page.setViewportSize(viewport);
  status = "paid";
  await expect(detail.getByRole("status")).toContainText(
    /Paiement de test confirmé|Test payment confirmed/,
    { timeout: 10000 },
  );
  await expect(stripeLink).toHaveCount(0);
  readsUnavailable = true;
  await expect(detail).toContainText(/Suivi suspendu|Status refresh paused/, { timeout: 10000 });
  await expect(detail.getByRole("status")).toContainText(
    /Paiement de test confirmé|Test payment confirmed/,
  );
  readsUnavailable = false;
  await detail.getByRole("button", { name: /Actualiser les accès|Refresh access/ }).click();
  await detail.locator('a[href="/backoffice/services/stripe/tests"]').click();
  await expect(page.locator("app-checkout-list tbody a")).toHaveCount(1);
  const list = page.locator("app-checkout-list");
  await chooseWorkspaceFilter(
    page,
    list.locator("app-filter-menu"),
    /État|Status|status/,
    /Paiement de test confirmé|Test payment confirmed/,
  );
  await checkColumnSort(page, list.locator("table"), 2, "ascending", "sort", "amountAsc");
  await checkColumnSort(
    page,
    list.locator("table"),
    2,
    "descending",
    "sort",
    "amountDesc",
    "Space",
  );
  await list.locator("app-list-search input").fill(invoice.invoiceNumber);
  await expect(list.locator("tbody a")).toHaveCount(1);
  const csv = await readTableCsv(page, list.locator("app-table-export"), "stripe-tests.csv");
  expect(csv).toContain('"350000"');
  expect(csv).not.toContain("cs_test_example");
  expect(csv).not.toContain("https://");
  expect(csv).not.toContain(clientId);
  expect(csv).not.toContain(writes[0].requestId);
  await list.locator("tbody a").click();
  expect(new URL(page.url()).searchParams.get("sort")).toBe("amountDesc");
  await detail.locator('a[href^="/backoffice/services/stripe/tests"]').click();
  await expect(list.locator("app-list-search input")).toHaveValue(invoice.invoiceNumber);
  await list.locator('a[href*="/tests/new"]').click();
  await expect(field).toBeEnabled();
  await panel.locator('a[href^="/backoffice/services/stripe/tests"]').click();
  await expect(list.locator('th[aria-sort="descending"]')).toHaveCount(1);
  await list.locator("nav a").first().click();
  await page.locator('app-provider-connection a[href*="/stripe/tests"]').click();
  await expect(list.locator("app-list-search input")).toHaveValue(invoice.invoiceNumber);
  expect(writes).toHaveLength(2);
  expect(new URL(page.url()).searchParams.get("filter")).toBe("paid");
  await page.unroute("**/api/invoices");
}
