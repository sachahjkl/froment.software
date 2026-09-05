import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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

for (const [kind, id] of [
  ["quotes", quoteId],
  ["invoices", invoiceId],
]) {
  test(`${kind}: responsive editor and summary`, async ({ page, colorScheme }) => {
    await openPage(page, `/backoffice/${kind}/${id}`, colorScheme);
    await expect(page.locator(".document-line")).toHaveCount(3);
    const form = await page.locator(".document-editor > form").boundingBox();
    const summary = await page.locator("[appOutcomePanel]").boundingBox();
    if (page.viewportSize().width >= 1024) {
      expect(Math.abs(form.y - summary.y)).toBeLessThan(2);
      expect(summary.x).toBeGreaterThan(form.x + form.width);
    } else {
      expect(summary.y).toBeGreaterThanOrEqual(form.y + form.height);
    }
  });
}

test("client form and complete account address", async ({ page, colorScheme }) => {
  await openPage(page, `/backoffice/clients/${clientId}/profile`, colorScheme);
  await expect(page.locator(".profile-form")).toBeVisible();
  const summary = page.locator(".account summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(page.locator(".account-details p")).toHaveText(accountEmail);
  await expect(page.locator(".account-details")).toBeVisible();
  const bounds = await page.locator(".account-details").boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
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
