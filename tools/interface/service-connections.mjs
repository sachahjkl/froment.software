import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId } from "./fixtures.mjs";
import { checkCheckout } from "./checkout.mjs";

export async function checkServiceConnections(page, testInfo) {
  await page.goto("/backoffice/configuration/services");
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
  await page.getByRole("link", { name: /Vérifier Resend|Check Resend/ }).click();
  await expect(page.locator("#main-content")).toBeFocused();
  const form = page.locator("app-email-test");
  expect(
    await form
      .locator("header p")
      .evaluate((paragraph) => getComputedStyle(paragraph).maxInlineSize),
  ).toBe("none");
  await expect(form.getByRole("status")).toContainText(/Aucun test|No test/);
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
  await form.getByRole("link", { name: /Retour aux connexions|Back to connections/ }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/services\/resend$/);
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
  status = "accepted";
  await expect(form.getByRole("status")).toContainText(
    /remise non confirmée|delivery unconfirmed/,
    { timeout: 10000 },
  );
  status = "delivered";
  await expect(form.getByRole("status")).toContainText(/Remise confirmée|Delivery confirmed/, {
    timeout: 10000,
  });
  unavailable = true;
  await expect(form).toContainText(/Suivi suspendu|Status refresh paused/, { timeout: 10000 });
  await expect(form.getByRole("status")).toContainText(/Remise confirmée|Delivery confirmed/);
  unavailable = false;
  await form.getByRole("button", { name: /Actualiser le suivi|Refresh test status/ }).click();
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
  status = "queued";
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
  await form.getByRole("link", { name: /Retour aux connexions|Back to connections/ }).click();
  await expect(page).toHaveURL(/configuration\/services$/);
  await checkCheckout(page, testInfo);
  await page.getByRole("link", { name: /Ouvrir les simulations|Open simulations/ }).click();
}
