import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { rm, writeFile } from "node:fs/promises";
import { mockApi, quoteId } from "./fixtures.mjs";

export async function checkCatalogZoom(testInfo) {
  const profile = testInfo.outputPath("catalog-zoom-profile");
  const context = await chromium.launchPersistentContext(profile, {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    args: ["--no-sandbox", "--window-size=1440,1000"],
    viewport: null,
    baseURL: "http://127.0.0.1:4300",
    locale: "fr-FR",
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  try {
    const page = context.pages()[0];
    await mockApi(page);
    await page.route("**/api/catalog", (route) =>
      route.fulfill({
        json: [
          {
            id: quoteId,
            description: "Développement Angular",
            quantityMilli: 1000,
            unitPriceCents: 12501,
            vatRateBasisPoints: 2000,
            currency: "EUR",
            version: 3,
            archived: false,
          },
        ],
      }),
    );
    await page.goto("/backoffice/catalogue");
    await expect(page.locator("app-catalog tbody tr")).toHaveCount(1);
    expect(await page.evaluate(() => innerWidth)).toBe(1440);
    expect(await page.evaluate(() => devicePixelRatio)).toBe(1);
    const settings = await context.newPage();
    await settings.goto("chrome://settings/appearance", { waitUntil: "commit" });
    await settings.evaluate(
      () => new Promise((resolve) => chrome.settingsPrivate.setDefaultZoom(2, resolve)),
    );
    await settings.close();
    await page.bringToFront();
    await expect.poll(() => page.evaluate(() => devicePixelRatio)).toBe(2);
    expect(await page.evaluate(() => innerWidth)).toBe(720);
    expect(await page.evaluate(() => visualViewport.scale)).toBe(1);
    const protocol = await context.newCDPSession(page);
    const capture = async (name) => {
      await page.evaluate(() => window.scrollTo(0, 0));
      const { contentSize } = await protocol.send("Page.getLayoutMetrics");
      const { data } = await protocol.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
        clip: { ...contentSize, scale: 1 },
      });
      await writeFile(testInfo.outputPath(name), Buffer.from(data, "base64"));
    };
    await expect(page.locator(".sidebar")).toBeHidden();
    await expect(page.locator(".navigation-trigger")).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      await page.locator("#catalog-search").fill("Angular");
      await expect(page.locator("app-catalog tbody tr")).toHaveCount(1);
      await page.locator("[appFilterChip]").focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#catalog-search")).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(audit.violations).toEqual([]);
      await capture(`catalog-zoom-200-${theme}.png`);
    }
    await page.locator("app-catalog app-page-header a").click();
    await expect(page.locator(".catalog-form")).toBeVisible();
    await page.locator('.catalog-form [type="submit"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#catalog-description")).toBeFocused();
    await page.locator("#catalog-description").fill("Prestation non enregistrée");
    await page.locator("#catalog-quantity").fill("0");
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page.locator("#catalog-quantity")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await capture("catalog-form-zoom-200.png");
    await page.locator(".navigation-trigger").click();
    await expect(page.getByRole("dialog").locator(".drawer-heading .account")).toBeVisible();
    const accountBounds = await page.getByRole("dialog").locator(".account summary").boundingBox();
    const closeBounds = await page.getByRole("dialog").locator("[data-drawer-close]").boundingBox();
    expect(Math.abs(accountBounds.height - closeBounds.height)).toBeLessThan(1);
    await page.getByRole("dialog").locator('a[href="/backoffice/catalogue"]').click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await expect(page.getByRole("alertdialog").locator("[data-confirmation-cancel]")).toBeFocused();
    await capture("catalog-confirmation-zoom-200.png");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#catalog-description")).toHaveValue("Prestation non enregistrée");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}
