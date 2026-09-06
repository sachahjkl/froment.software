import { test, expect } from "@playwright/test";
import { scalarDocumentation } from "../../packages/api/src/documentation/scalar.ts";
import AxeBuilder from "@axe-core/playwright";
import { checkTeam } from "./team.mjs";
import { checkCreditNotes } from "./credit-notes.mjs";
import { checkBankLedger } from "./bank-ledger.mjs";
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

async function checkNoticeSpacing(page) {
  const failures = await page.locator(".notice-flow > .notice").evaluateAll((notices) =>
    notices.flatMap((notice) => {
      if (notice.getClientRects().length === 0) return [];
      let previous = notice.previousElementSibling;
      while (previous && previous.getBoundingClientRect().height === 0)
        previous = previous.previousElementSibling;
      if (!previous) return [];
      const gap = notice.getBoundingClientRect().top - previous.getBoundingClientRect().bottom;
      if (gap >= 12) return [];
      return [{ text: notice.textContent, gap }];
    }),
  );
  expect(failures).toEqual([]);
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
      await page
        .locator(".payment-form")
        .getByRole("textbox", { name: /Référence|Reference/ })
        .fill("Unsubmitted payment reference");
      await page
        .getByRole("link", { name: /Préparer un rappel de paiement|Prepare a payment reminder/ })
        .click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /^(Confirmer|Confirm)$/ })
        .click();
      await expect(page.locator("#email-reference")).toHaveValue("FA-2026-000001");
      await expect(page.locator("#email-body")).toHaveValue(/3.?500[,.]00/);
      await page.locator('app-emails .composer button[type="submit"]').click();
      await expect(page.locator('app-emails [role="status"]')).toContainText(
        /courriel non envoyé|email not sent/,
      );
      await page.locator("#reminder-date").fill("2026-10-01T10:00");
      await page.getByRole("button", { name: /Programmer la relance|Schedule reminder/ }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /^(Confirmer|Confirm)$/ })
        .click();
      await expect(page.locator('app-reminder-schedules [role="status"]')).toContainText(
        /Relance enregistrée|Reminder saved/,
      );
      await page.getByRole("button", { name: /Annuler la programmation|Cancel schedule/ }).click();
      await page
        .getByRole("alertdialog")
        .getByRole("button", { name: /^(Confirmer|Confirm)$/ })
        .click();
      await expect(page.locator("app-reminder-schedules ol")).toContainText(/Annulée|Cancelled/);
      await page.goto(`/backoffice/invoices/${invoiceId}`);
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
  await mockApi(page);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: { code: "authentication.required" } }),
  );
  await page.goto("/backoffice/login");
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
  }, colorScheme);
  await expect(page.locator(".login-page form")).toBeVisible();
  await expect(page.locator(".login-page .ds-panel")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const loginAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(loginAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  await page.unroute("**/api/auth/refresh");
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
  await expect(page.locator('.account-security input[type="password"]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("account-security.png"), fullPage: true });
  await checkPasskeys(page, testInfo);
  for (const [tab, selector] of [
    ["entreprise", ".issuer-page"],
    ["conditions", ".presets-page"],
    ["catalogue", ".catalog-page"],
  ]) {
    await page.goto(`/backoffice/configuration/${tab}`);
    await expect(page.locator(`${selector} form`)).toBeVisible();
    for (const surface of [selector, `${selector} form`]) {
      const style = await page.locator(surface).evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          background: computed.backgroundColor,
          border: computed.borderTopWidth,
          shadow: computed.boxShadow,
          padding: computed.paddingLeft,
        };
      });
      expect(style.background).toBe("rgba(0, 0, 0, 0)");
      expect(style.border).toBe("0px");
      expect(style.shadow).toBe("none");
      if (surface.endsWith("form")) expect(style.padding).toBe("0px");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    if (tab === "catalogue") {
      const label = await page.locator(".filters > .choice").boundingBox();
      const checkbox = await page.locator(".filters > .choice input").boundingBox();
      expect(Math.abs(label.y + label.height / 2 - checkbox.y - checkbox.height / 2)).toBeLessThan(
        1,
      );
    }
    await page.screenshot({ path: testInfo.outputPath(`${tab}.png`), fullPage: true });
  }
  await page.goto("/backoffice/configuration/services");
  const serviceSpacing = await page
    .locator("app-integrations section > [appNotice]")
    .first()
    .evaluate(
      (notice) =>
        notice.getBoundingClientRect().top -
        notice.previousElementSibling.getBoundingClientRect().bottom,
    );
  expect(serviceSpacing).toBeGreaterThanOrEqual(16);
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
  await expect(page.locator("app-integrations .retries")).toContainText(
    /Tentatives épuisées|Attempts exhausted/,
  );
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
  await page.getByRole("button", { name: /Enregistrer le brouillon|Save draft/ }).click();
  await expect(page.locator(".drafts li")).toContainText("Votre devis / Your quote");
  await page.reload();
  await page
    .locator(".drafts")
    .getByRole("button", { name: /Ouvrir|Open/, exact: true })
    .click();
  await expect(page.locator("#email-subject")).toHaveValue("Votre devis / Your quote");
  await expect(page.locator("#email-recipient")).toHaveValue("client@example.test");
  await page
    .locator("#email-body")
    .fill("Bonjour,\nVoici le récapitulatif de notre proposition.\nCordialement.");
  await page
    .getByRole("button", { name: /Créer un modèle avec ce texte|Create a template from this text/ })
    .click();
  await expect(page.locator(".templates li")).toContainText("Votre devis / Your quote");
  await page.getByRole("button", { name: /Utiliser ce modèle|Use this template/ }).click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("#email-recipient")).toHaveValue("client@example.test");
  await page.locator('app-emails .composer button[type="submit"]').click();
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
  await checkNoticeSpacing(page);
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
  await page
    .getByRole("button", { name: /Historique des rapprochements|Reconciliation history/ })
    .click();
  await expect(page.locator(`#bank-history-${quoteId}`)).toContainText("Incorrect association");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const bankingAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(bankingAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("banking.png"), fullPage: true });
  await checkNoticeSpacing(page);
  await page.reload();
  await page.getByRole("button", { name: /^(Rapprocher|Reconcile)$/ }).click();
  await page.locator(".editor select").first().selectOption(invoiceId);
  await page.locator(".editor select").nth(1).selectOption(clientId);
  await page.locator("#bank-allocation-amount").fill("40.00");
  await page
    .locator(".editor")
    .getByRole("button", { name: /^(Rapprocher|Reconcile)$/ })
    .click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await page.getByRole("button", { name: /Gérer les affectations|Manage allocations/ }).click();
  await expect(page.locator("#bank-allocation-amount")).toHaveValue("60.00");
  await page.locator("#bank-allocation-amount").fill("63.00");
  await page.locator("#bank-fee-amount").fill("3.00");
  await page.locator(".editor select").first().selectOption(invoiceId);
  await page.locator(".editor select").nth(1).selectOption(clientId);
  const allocationAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(allocationAudit.violations).toEqual([]);
  await page
    .locator(".editor")
    .getByRole("button", { name: /^(Rapprocher|Reconcile)$/ })
    .click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("app-banking > section > ol > li")).toHaveCount(0);
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

test("client signing form stays inside its panel", async ({ page, colorScheme }, testInfo) => {
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
  await page.goto("/design/feedback");
  const trigger = page.getByRole("button", { name: /Ouvrir une confirmation|Open a confirmation/ });
  await trigger.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.locator("[data-confirmation-cancel]")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator("button").last()).toBeFocused();
  const dialogAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(dialogAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("design-confirmation.png"), fullPage: true });
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator('.confirmation-demo [role="status"]')).toContainText(
    /annulée|cancelled/,
  );
  await trigger.click();
  await dialog.locator("button").last().click();
  await expect(page.locator('.confirmation-demo [role="status"]')).toContainText(
    /confirmée|confirmed/,
  );
  const locales = { light: "fr", dark: "en" };
  const language = locales[colorScheme];
  await page.route(`**/api/docs/${language}`, (route) =>
    route.fulfill({ contentType: "text/html", body: scalarDocumentation(language) }),
  );
  await page.route(`**/api/openapi.${language}.json`, (route) =>
    route.fulfill({
      json: {
        openapi: "3.1.0",
        info: { title: "Test API", version: "1" },
        paths: {
          "/health": {
            get: {
              summary: "Health",
              description: "> [!note]\n> Required permission: `bank.read`.",
              responses: { 200: { description: "Success" } },
            },
          },
        },
      },
    }),
  );
  await page.goto(`/api/docs/${language}`);
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  const labels = { fr: "Télécharger le document OpenAPI", en: "Download" };
  await expect(
    page.getByRole("button", { name: new RegExp(labels[language]) }).first(),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.locator(".markdown-alert-note")).toContainText("bank.read");
  await page.screenshot({ path: testInfo.outputPath("scalar.png"), fullPage: true });
  await checkTeam(page, testInfo);
  await checkCreditNotes(page, testInfo);
  await checkBankLedger(page, testInfo);
});
import { checkPasskeys } from "./passkeys.mjs";
