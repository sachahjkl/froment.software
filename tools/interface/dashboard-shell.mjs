import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function openBackOfficeNavigation(page) {
  const trigger = page.locator(".navigation-trigger");
  await expect(page.locator(".workspace-header")).toBeVisible();
  if (await trigger.isVisible()) await trigger.click();
}

export async function checkDashboardShell(page, testInfo) {
  const originalUrl = page.url();
  await expect(page.locator("app-site-header, app-site-footer")).toHaveCount(0);
  await expect(page.locator("main")).toHaveCSS("max-width", "none");
  await expect(page.locator("main")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator('.workspace-header a[href="/api/docs"]')).toBeVisible();
  const main = await page.locator("main").boundingBox();
  const sidebar = page.locator(".sidebar");
  if (page.viewportSize().width >= 1024) {
    const bounds = await sidebar.boundingBox();
    expect(Math.abs(main.x - bounds.x - bounds.width)).toBeLessThan(1);
    expect(main.width).toBeGreaterThan(1100);
    await expect(sidebar.locator(":scope > :first-child")).toHaveClass(/account/);
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveCSS("box-shadow", "none");
  } else {
    await expect(sidebar).toBeHidden();
    expect(main.x).toBe(0);
    await openBackOfficeNavigation(page);
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.locator("[data-drawer-close]")).toBeFocused();
    await expect(drawer.locator("app-back-office-nav a")).toHaveCount(8);
    await expect(drawer.locator('app-back-office-nav a[aria-current="page"]')).toHaveCSS(
      "box-shadow",
      "none",
    );
    await expect(drawer.locator(".drawer-heading .account")).toBeVisible();
    const accountBounds = await drawer.locator(".account summary").boundingBox();
    const closeBounds = await drawer.locator("[data-drawer-close]").boundingBox();
    expect(Math.abs(accountBounds.height - closeBounds.height)).toBeLessThan(1);
    expect(Math.abs(accountBounds.y - closeBounds.y)).toBeLessThan(1);
    await expect(drawer.locator(".drawer-heading")).not.toContainText(
      /Navigation du back-office|Back-office navigation/,
    );
    await page.keyboard.press("Shift+Tab");
    expect(await drawer.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("navigation-drawer.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await expect(drawer).toHaveCount(0);
    await expect(page.locator(".navigation-trigger")).toBeFocused();
  }
  await page.locator(".skip-link").focus();
  await expect(page.locator(".skip-link")).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await expect(page).toHaveURL(originalUrl);
  await expect(page.locator(".skip-link")).toHaveCSS("clip-path", "inset(50%)");
  await page.screenshot({ path: testInfo.outputPath("dashboard-shell.png"), fullPage: true });
  let finishAccount;
  const delayAccount = async (route) => {
    await new Promise((resolve) => {
      finishAccount = resolve;
    });
    await route.fulfill({ status: 503, json: { code: "authentication.error" } });
  };
  await page.route("**/api/auth/account", delayAccount);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".sidebar .account-status")).toContainText(
    /Loading account|Chargement du compte/,
  );
  await openBackOfficeNavigation(page);
  await page.screenshot({ path: testInfo.outputPath("account-loading.png"), fullPage: true });
  finishAccount();
  await expect(page.locator(".account-status:visible")).toContainText(/unavailable|indisponibles/);
  await page.screenshot({ path: testInfo.outputPath("account-error.png"), fullPage: true });
  await page.unroute("**/api/auth/account", delayAccount);
  await page
    .locator(".account-status:visible")
    .getByRole("button", { name: /Retry|Réessayer/ })
    .click();
  await expect(page.locator(".account:visible")).toBeVisible();
  if (page.viewportSize().width < 1024) {
    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 900 });
  }
}
