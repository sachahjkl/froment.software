import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  accountEmail,
  clientId,
  quoteId,
  invoiceId,
  issuedInvoice,
  quoteToken,
  mockApi,
} from "./fixtures.mjs";

async function openPage(page, route, colorScheme) {
  await mockApi(page);
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
  }, colorScheme);
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
}

for (const [kind, id] of [
  ["quotes", quoteId],
  ["invoices", invoiceId],
]) {
  test(`${kind}: responsive editor and summary`, async ({ page, colorScheme }, testInfo) => {
    await openPage(page, `/backoffice/${kind}/${id}`, colorScheme);
    await expect(page.locator(".document-line")).toHaveCount(3);
    const conditionsSpacing = await page
      .locator(".document-editor > form > label")
      .filter({
        has: page.locator("textarea"),
      })
      .evaluate((field) => {
        let previous = field.previousElementSibling;
        while (previous && previous.getClientRects().length === 0) {
          previous = previous.previousElementSibling;
        }
        return {
          actual: field.getBoundingClientRect().top - previous.getBoundingClientRect().bottom,
          expected: Number.parseFloat(getComputedStyle(field.parentElement).rowGap),
        };
      });
    expect(conditionsSpacing.expected).toBeGreaterThan(0);
    expect(Math.abs(conditionsSpacing.actual - conditionsSpacing.expected)).toBeLessThan(1);
    const form = await page.locator(".document-editor > form").boundingBox();
    const summary = await page.locator("[appOutcomePanel]").boundingBox();
    if (page.viewportSize().width >= 1024) {
      expect(Math.abs(form.y - summary.y)).toBeLessThan(2);
      expect(summary.x).toBeGreaterThan(form.x + form.width);
    } else {
      expect(summary.y).toBeGreaterThanOrEqual(form.y + form.height);
    }
    if (kind === "invoices") {
      await page.route(`**/api/invoices/${invoiceId}`, (route) =>
        route.fulfill({ json: issuedInvoice }),
      );
      await page.reload();
      await page.getByRole("button", { name: /Annuler cette saisie|Cancel this entry/ }).click();
      const reason = page.getByRole("textbox", {
        name: /Motif de la correction|Correction reason/,
      });
      await expect(reason).toBeVisible();
      await reason.fill("Montant saisi par erreur");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath("payment-correction.png"),
        fullPage: true,
      });
    }
  });
}

test("client form and complete account address", async ({ page, colorScheme }, testInfo) => {
  await openPage(page, `/backoffice/clients/${clientId}/profile`, colorScheme);
  await expect(page.locator(".profile-form")).toBeVisible();
  const summary = page.locator(".account summary");
  if (page.viewportSize().width >= 1024) {
    const icon = await summary.locator("svg").boundingBox();
    const label = await summary.locator("span").boundingBox();
    expect(Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2)).toBeLessThan(1);
  }
  await summary.focus();
  await summary.press("Enter");
  await expect(page.locator(".account-details p")).toHaveText(accountEmail);
  await expect(page.locator(".account-details")).toBeVisible();
  const bounds = await page.locator(".account-details").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await page.locator(".account-details p").click();
  await expect(page.locator(".account-details")).toBeVisible();
  await page.locator("footer").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".account-details")).toBeHidden();
  await summary.click();
  await expect(page.locator(".account-details")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".account-details")).toBeHidden();
  await expect(summary).toBeFocused();
  await summary.click();
  await page.getByRole("link", { name: /Sécurité du compte|Account security/ }).click();
  await expect(page.locator('.account-security input[type="password"]')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("account-security.png"), fullPage: true });
  await page.goto("/backoffice/configuration/services");
  await expect(page.locator(".providers li")).toHaveCount(5);
  await expect(page.locator(".operations li")).toHaveCount(0);
  await page.locator(".providers button").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".operations li")).toHaveCount(1);
  await expect(page.locator(".operations li")).toContainText(
    /aucune opération réelle|no real operation/,
  );
  await expect(page.locator(".operations time")).not.toBeEmpty();
  await expect(page.locator('app-integrations [role="status"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const integrationAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(integrationAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("external-services.png"), fullPage: true });
  await page.goto("/backoffice/courriels");
  await page.locator("#email-recipient").fill("client@example.test");
  await page.locator("#email-reference").fill("DE-2026-000001");
  await page.locator("#email-subject").fill("Votre devis / Your quote");
  const bankLink = page.locator('a[href="/backoffice/banque"]').first();
  await bankLink.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
  const confirmationAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(confirmationAudit.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(bankLink).toBeFocused();
  await expect(page.locator("#email-subject")).toHaveValue("Votre devis / Your quote");
  await page
    .locator("#email-body")
    .fill("Bonjour,\nVoici le récapitulatif de notre proposition.\nCordialement.");
  await page.locator('app-emails button[type="submit"]').click();
  await expect(page.locator('app-emails [role="status"]')).toContainText(
    /courriel non envoyé|email not sent/,
  );
  await expect(page.locator('app-emails [role="status"]')).toBeFocused();
  await expect(page.locator("app-emails .input:user-invalid")).toHaveCount(0);
  await page.locator("app-emails details summary").first().click();
  await expect(page.locator("app-emails .message-body").first()).toContainText("Bonjour");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const emailAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(emailAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("emails.png"), fullPage: true });
  await page.goto("/backoffice/banque");
  await page.locator("#bank-account").fill("MAIN");
  await page.locator("#bank-file").setInputFiles({
    name: "statement.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "transaction_id,booked_on,amount,currency,description\nBANK-001,2026-09-01,100.00,EUR,Client payment",
    ),
  });
  await page.locator('app-banking button[type="submit"]').click();
  await expect(page.locator("app-banking li")).toHaveCount(1);
  await expect(page.locator('app-banking [role="status"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const bankingAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(bankingAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("banking.png"), fullPage: true });
  await mockApi(page, { mode: "client" });
  await page.goto("/backoffice/client");
  await expect(page.locator(".invoice-balance dd")).toHaveCount(3);
  await expect(page.locator(".invoice-balance dd").last()).toContainText(/3.?500[,.]00/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const portalAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(portalAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("client-payments.png"), fullPage: true });
});

test("client signing form stays inside its panel", async ({ page, colorScheme }) => {
  await openPage(page, `/quote/signature#${quoteToken}`, colorScheme);
  await expect(page.locator("#public-quote-signer-name")).toBeVisible();
  const panel = await page.locator(".signature-panel").boundingBox();
  for (const input of await page.locator(".signature-panel input").all()) {
    const box = await input.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
  }
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
});
