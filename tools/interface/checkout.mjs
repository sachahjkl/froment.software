import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId, invoiceId, issuedInvoice } from "./fixtures.mjs";

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
  await page.getByRole("link", { name: /Tester Stripe Checkout|Test Stripe Checkout/ }).click();
  const panel = page.locator("app-checkout");
  await expect(panel).toContainText(/Aucune facture éligible|No eligible invoice/);
  await expect(panel).toContainText(/Secret de signature absent|Signing secret absent/);
  empty = false;
  await panel.getByRole("button", { name: /Actualiser les accès|Refresh access/ }).click();
  await panel.getByRole("button", { name: /Créer la page de test|Create test page/ }).click();
  const field = page.locator("#checkout-invoice");
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await field.selectOption(invoiceId);
  await expect(panel).toContainText(/3[\s\u202f\u00a0,]?500[,.]00/);
  await panel.getByRole("link", { name: /Retour aux connexions|Back to connections/ }).click();
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
  await expect(field).toHaveValue(invoiceId);
  await expect(field).toBeDisabled();
  expect(writes).toHaveLength(1);
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
  status = "open";
  const stripeLink = panel.getByRole("link", { name: /Ouvrir Stripe|Open Stripe/ });
  await expect(stripeLink).toBeVisible({ timeout: 10000 });
  await expect(stripeLink).toHaveAttribute("target", "_blank");
  await expect(stripeLink).toHaveAttribute("data-button-variant", "primary");
  await expect(panel.getByRole("status")).toContainText(
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
  await expect(panel.getByRole("status")).toContainText(
    /Paiement de test confirmé|Test payment confirmed/,
    { timeout: 10000 },
  );
  await expect(stripeLink).toHaveCount(0);
  readsUnavailable = true;
  await expect(panel).toContainText(/Suivi suspendu|Status refresh paused/, { timeout: 10000 });
  await expect(panel.getByRole("status")).toContainText(
    /Paiement de test confirmé|Test payment confirmed/,
  );
  readsUnavailable = false;
  await panel.getByRole("button", { name: /Actualiser les accès|Refresh access/ }).click();
  await panel.getByRole("link", { name: /Retour aux connexions|Back to connections/ }).click();
  await page.unroute("**/api/invoices");
}
