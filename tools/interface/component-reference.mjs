import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { referenceCatalog } from "../../packages/web/src/app/pages/design/reference-catalog.ts";
import { componentReferenceText } from "../../packages/l10n/src/component-reference.ts";

async function navigation(page) {
  const sidebar = page.locator(".reference-sidebar");
  if (await sidebar.isVisible()) return sidebar;
  await page.locator(".reference-mobile-header button").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.locator("[data-drawer-close]")).toBeFocused();
  return drawer;
}

async function openReference(page, id) {
  const links = await navigation(page);
  await links.locator(`[data-reference-link="${id}"]`).click();
  await expect(page.locator(`[data-component="${id}"]`)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function capture(page, testInfo, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations, `Component reference: ${name}`).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath(`component-reference-${name}.png`),
    fullPage: true,
  });
}

export async function checkComponentReference(page, testInfo) {
  const origin = new URL(testInfo.project.use.baseURL).origin;
  const forbiddenRequests = [];
  const errors = [];
  const reportError = (error) => errors.push(error.message);
  const protect = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.pathname.startsWith("/api/") ||
      url.origin !== origin ||
      !["GET", "HEAD"].includes(request.method())
    ) {
      forbiddenRequests.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort();
      return;
    }
    await route.fallback();
  };
  page.on("pageerror", reportError);
  await page.route("**/*", protect);
  try {
    await page.goto("/design");
    await expect(page).toHaveURL(/\/design\/button$/);
    await expect(page.locator("app-root > .standalone-shell")).toHaveCount(1);
    await expect(
      page.locator("app-root > .app-shell > app-site-header, app-back-office-header"),
    ).toHaveCount(0);
    const language = await page.locator("html").getAttribute("lang");
    const text = componentReferenceText[language];
    expect(text).toBeDefined();
    const footer = page.locator(".reference-main > app-site-footer");
    await expect(footer.locator("app-language-selector")).toBeVisible();
    await expect(footer.locator("app-theme-toggle")).toBeVisible();

    const links = await navigation(page);
    await expect(links.locator("[data-reference-link]")).toHaveCount(referenceCatalog.length);
    const search = links.locator("app-list-search input");
    await search.fill("objctpicker");
    await expect(links.locator("[data-reference-link]")).toHaveCount(1);
    await expect(links.getByRole("status")).toHaveText(
      text.componentCount.one.replace("{count}", "1"),
    );
    await search.fill("zzzzzzzzzz");
    await expect(links.locator("nav")).toContainText(text.noResults);
    await links.getByRole("button", { name: text.clear, exact: true }).click();
    await expect(links.locator("[data-reference-link]")).toHaveCount(referenceCatalog.length);
    if (!(await page.locator(".reference-sidebar").isVisible())) {
      await page.keyboard.press("Escape");
      await expect(page.locator(".reference-mobile-header button")).toBeFocused();
    }

    for (const entry of referenceCatalog.filter((item) => item.id !== "workflows")) {
      await openReference(page, entry.id);
      const article = page.locator(`[data-component="${entry.id}"]`);
      await expect(article.getByRole("heading", { level: 1 })).toHaveText(entry.name);
      await expect(article.locator("[data-variant]")).toHaveCount(entry.variants);
      await expect(article.locator("pre code")).not.toBeEmpty();
      await expect(article.locator("#story-properties")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        entry.id,
      ).toBe(false);
    }

    await openReference(page, "button");
    const controls = page.locator("[storyControls]");
    await controls.getByLabel(text.label, { exact: true }).fill("<img src=x onerror=alert(1)>");
    await controls.getByLabel(text.variant, { exact: true }).selectOption("danger");
    const button = page.locator("[storyPreview] button");
    await expect(button).toContainText("<img src=x onerror=alert(1)>");
    await expect(button).toHaveAttribute("data-button-variant", "danger");
    await expect(page.locator("[storyPreview] img")).toHaveCount(0);
    await controls.getByLabel(text.disabled, { exact: true }).check();
    await expect(button).toBeDisabled();
    await capture(page, testInfo, "button");

    await openReference(page, "filter-menu");
    const filterTrigger = page.locator("[storyPreview] app-filter-menu > button");
    await filterTrigger.click();
    const filters = page.getByRole("dialog");
    await expect(filters.getByRole("menuitem").first()).toBeFocused();
    await filters.getByRole("menuitem").filter({ hasText: text.status }).click();
    await expect(filters.locator("app-filter-choice input")).toBeFocused();
    await filters.locator("app-filter-choice input").fill(text.ready);
    await filters.getByRole("option").click();
    await expect(filters.getByRole("menuitem").first()).toBeFocused();
    await expect(filterTrigger).toContainText("1");
    await capture(page, testInfo, "filter-menu");
    await page.keyboard.press("Escape");
    await expect(filterTrigger).toBeFocused();

    await openReference(page, "confirmation");
    const confirmationTrigger = page.locator("[storyPreview] > button");
    await confirmationTrigger.click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmation.locator("button").last()).toBeFocused();
    await capture(page, testInfo, "confirmation");
    await page.keyboard.press("Escape");
    await expect(confirmationTrigger).toBeFocused();
    await expect(page.locator('[storyPreview] [role="status"]')).toContainText(text.cancelled);
    await confirmationTrigger.click();
    await confirmation.locator("button").last().click();
    await expect(page.locator('[storyPreview] [role="status"]')).toContainText(text.accepted);

    await openReference(page, "input");
    await page.locator('[storyPreview] button[type="submit"]').click();
    await expect(page.locator("[storyPreview] input")).toBeFocused();
    await expect(page.locator("#reference-email-error")).toHaveText(text.invalid);
    await capture(page, testInfo, "invalid-input");
    await page.reload();
    await expect(page.locator('[data-component="input"]')).toBeVisible();
    expect(forbiddenRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await page.unroute("**/*", protect);
    page.off("pageerror", reportError);
    await testInfo.attach("component-reference-safety", {
      body: JSON.stringify({ forbiddenRequests, errors }, null, 2),
      contentType: "application/json",
    });
  }
}
