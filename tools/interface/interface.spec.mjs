import { test, expect } from "@playwright/test";
import { scalarDocumentation } from "../../packages/api/src/documentation/scalar.ts";
import AxeBuilder from "@axe-core/playwright";
import { checkTeam } from "./team.mjs";
import { checkServiceConnections } from "./service-connections.mjs";
import { checkCreditNotes } from "./credit-notes.mjs";
import { checkBankingWorkspace } from "./banking-workspace.mjs";
import { checkBillingWorkspace } from "./billing-workspace.mjs";
import { checkCommercialWorkspace } from "./commercial-workspace.mjs";
import { checkCustomerWorkspace } from "./customer-workspace.mjs";
import { checkDesignWorkspace } from "./design-workspace.mjs";
import {
  checkConfigurationWorkspace,
  checkApiTokenWorkspace,
  checkAuditWorkspace,
} from "./configuration-workspace.mjs";
import { checkDashboardShell, openBackOfficeNavigation } from "./dashboard-shell.mjs";
import { checkClientsWorkspace } from "./clients-workspace.mjs";
import { checkCatalogWorkspace } from "./catalog-workspace.mjs";
import { checkCatalogZoom } from "./catalog-zoom.mjs";
import { checkWorkspaceZoom } from "./workspace-zoom.mjs";
import { checkEmailsWorkspace } from "./emails-workspace.mjs";
import { checkDefaultButtonTheme } from "./button-theme.mjs";
import { accountEmail, clientId, quoteId, invoiceId, quoteToken, mockApi } from "./fixtures.mjs";

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
    test.setTimeout(300_000);
    await openPage(page, `/backoffice/${kind}/${id}`, colorScheme);
    if (kind === "invoices") {
      await checkBillingWorkspace(page, testInfo);
      await checkCreditNotes(page, testInfo);
      await checkBankingWorkspace(page, testInfo);
    } else await checkCommercialWorkspace(page, testInfo);
  });
}

test("client form and complete account address", async ({ page, colorScheme }, testInfo) => {
  test.setTimeout(300_000);
  await mockApi(page);
  await checkDefaultButtonTheme(page, testInfo);
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ status: 401, json: { code: "authentication.required" } }),
  );
  await page.goto("/backoffice/login");
  await page.evaluate((theme) => {
    document.documentElement.dataset.theme = theme;
  }, colorScheme);
  await expect(page.locator(".login-page form")).toBeVisible();
  const mobileMenu = page.locator("app-site-header .menu-trigger");
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  const language = page.locator("app-site-header app-language-selector select:visible");
  const theme = page.locator("app-site-header app-theme-toggle button");
  await expect(language).toHaveAccessibleName(/Langue|Language/);
  await expect(language.locator("..").locator("span")).toHaveCount(0);
  await expect(page.locator("app-language-selector").getByText(/^(Langue|Language)$/)).toHaveCount(
    0,
  );
  expect((await language.boundingBox()).height).toBe((await theme.boundingBox()).height);
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await expect(page.locator(".login-page .ds-panel")).toHaveCount(0);
  await expect(page.locator("main")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("main")).toHaveCSS("box-shadow", "none");
  await expect(page.locator("app-login")).toHaveClass(/page-container/);
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: originalViewport.width, height: 1600 });
  const containerHeight = await page
    .locator("app-login")
    .evaluate((element) => element.getBoundingClientRect().height);
  await page.setViewportSize({ width: originalViewport.width, height: 1800 });
  expect(
    await page.locator("app-login").evaluate((element) => element.getBoundingClientRect().height),
  ).toBe(containerHeight);
  expect(
    await page.locator("main").evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThan(containerHeight);
  await page.setViewportSize(originalViewport);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const loginAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(loginAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  await page.unroute("**/api/auth/refresh");
  await checkClientsWorkspace(page, testInfo);
  await openPage(page, `/backoffice/clients/${clientId}/edit`, colorScheme);
  await expect(page.locator(".profile-form")).toBeVisible();
  await checkDashboardShell(page, testInfo);
  await openBackOfficeNavigation(page);
  const account = page.locator(".account:visible");
  const summary = account.locator("summary");
  const accountDetails = account.locator(".account-details");
  if (page.viewportSize().width >= 1024) {
    const icon = await summary.locator("img").boundingBox();
    const label = await summary.locator("span").boundingBox();
    expect(Math.abs(icon.y + icon.height / 2 - label.y - label.height / 2)).toBeLessThan(1);
  }
  await summary.focus();
  await summary.press("Enter");
  await expect(accountDetails.locator("p")).toHaveText(accountEmail);
  await expect(accountDetails).toBeVisible();
  const bounds = await accountDetails.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  await expect(accountDetails.locator("app-language-selector select")).toHaveCount(0);
  await expect(accountDetails.locator("app-theme-toggle button")).toHaveCount(0);
  const preferences = page.locator(".sidebar-bottom:visible");
  await expect(preferences.locator("app-language-selector select")).toBeVisible();
  await expect(preferences.locator("app-theme-toggle button")).toBeVisible();
  const accountMenuAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accountMenuAudit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("account-menu.png"), fullPage: true });
  await accountDetails.locator("p").click();
  await expect(accountDetails).toBeVisible();
  await page.locator("app-back-office-nav nav:visible").evaluate((element) => element.click());
  await expect(accountDetails).toBeHidden();
  await summary.click();
  await expect(accountDetails).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(accountDetails).toBeHidden();
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
  await checkPasskeys(page, testInfo);
  await checkCatalogWorkspace(page, testInfo);
  if (testInfo.project.name === "desktop") {
    await checkCatalogZoom(testInfo);
    await checkWorkspaceZoom(testInfo);
  }
  await checkEmailsWorkspace(page, testInfo);
  await checkNoticeSpacing(page);
});

test("client signing form stays inside its panel", async ({ page, colorScheme }, testInfo) => {
  test.setTimeout(360_000);
  await openPage(page, `/quote/signature#${quoteToken}`, colorScheme);
  await checkCustomerWorkspace(page, testInfo);
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
  await page.goto("/design/confirmation");
  const trigger = page.locator("[storyPreview] > button");
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
  await expect(page.locator('[storyPreview] [role="status"]')).toContainText(/annulée|cancelled/);
  await trigger.click();
  await dialog.locator("button").last().click();
  await expect(page.locator('[storyPreview] [role="status"]')).toContainText(/confirmée|confirmed/);
  await checkDesignWorkspace(page, testInfo);
  await checkConfigurationWorkspace(page, testInfo);
  await checkApiTokenWorkspace(page, testInfo);
  await checkAuditWorkspace(page, testInfo);
  await checkServiceConnections(page, testInfo);
  await page.locator("app-integrations form select").selectOption("email");
  await page.locator('app-integrations form button[type="submit"]').click();
  await expect(page.locator(".operations li")).toHaveCount(1);
  await expect(page.locator(".operations li")).toContainText(
    /aucune opération réelle|no real operation/,
  );
  await expect(page.locator(".operations time")).not.toBeEmpty();
  await expect(page.locator('app-integrations [role="status"]')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await expect(page.locator("app-integrations .retries")).toContainText(
    /Tentatives épuisées|Attempts exhausted/,
  );
  await page.screenshot({ path: testInfo.outputPath("external-services.png"), fullPage: true });
  await checkTeam(page, testInfo);
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
});
import { checkPasskeys } from "./passkeys.mjs";
