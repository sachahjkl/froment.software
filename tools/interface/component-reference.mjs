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
  const failures = [];
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
      if (entry.id === "mermaid-diagrams") {
        await expect(article.locator(".mermaid svg")).toHaveCount(3);
        await expect(article.locator(".mermaid-error")).toHaveCount(0);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        entry.id,
      ).toBe(false);
    }

    await openReference(page, "back-office-nav");
    const localNavigation = page.locator("[storyPreview] app-back-office-nav");
    await expect(localNavigation.locator('[aria-current="page"]')).toHaveCount(1);
    await page.locator("[storyControls] select").selectOption("/backoffice/quotes/example");
    await expect(localNavigation.locator('[aria-current="page"]')).toHaveCount(1);
    await page.locator("[storyControls] select").selectOption("/design/back-office-nav");
    await expect(localNavigation.locator("[aria-current]")).toHaveCount(0);
    await localNavigation.locator("a").first().click();
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      "/backoffice/dashboard",
    );
    await expect(page).toHaveURL(/\/design\/back-office-nav$/);

    await openReference(page, "document-issues");
    await expect(page.locator("[storyPreview] .party")).toHaveCount(2);
    await page.locator("[storyPreview] .party a").first().click();
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      "/backoffice/configuration/entreprise",
    );
    await page.locator("[storyControls] select").first().selectOption("invoice");
    await page.locator("[storyControls] select").last().selectOption("client");
    await expect(page.locator("[storyPreview] .party")).toHaveCount(1);
    await page.locator("[storyPreview] .party a").click();
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      `/backoffice/clients/${text.examples.clientId}/profile`,
    );
    await expect(page).toHaveURL(/\/design\/document-issues$/);

    await openReference(page, "global-search");
    const businessSearch = page.locator("[storyPreview] app-global-search input");
    const searchResults = page.locator("[storyPreview] app-global-search .results");
    const closeSearch = async () => {
      await businessSearch.press("Escape");
      await expect(searchResults).toHaveCount(0);
      await expect(businessSearch).toBeFocused();
      await expect(businessSearch).toHaveValue(text.examples.firstName);
      await expect(businessSearch).not.toHaveAttribute("aria-controls", /\S/);
    };
    await businessSearch.fill(text.examples.firstName);
    await expect(searchResults.locator("li")).toHaveCount(4);
    await expect(searchResults.locator("section")).toHaveCount(4);
    await businessSearch.press("Tab");
    await expect(searchResults.locator(".result-heading button")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(searchResults.locator("li a").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      `/backoffice/clients/${text.examples.clientId}`,
    );
    await expect(page).toHaveURL(/\/design\/global-search$/);
    await expect(searchResults).toHaveCount(0);
    for (const scenario of ["loading", "error", "empty"]) {
      await page.locator("[storyControls] select").selectOption(scenario);
      await businessSearch.fill(text.examples.firstName);
      await expect(searchResults).toBeVisible();
      await expect(searchResults.locator("li")).toHaveCount(0);
      if (scenario === "error") await expect(searchResults.getByRole("alert")).toBeVisible();
      if (scenario === "loading") await expect(searchResults.getByRole("status")).toBeVisible();
      if (scenario === "empty") await expect(searchResults.getByRole("status")).toContainText("0");
      await closeSearch();
      await businessSearch.fill(text.examples.firstName);
      await expect(searchResults).toBeVisible();
      await expect(searchResults.locator("li")).toHaveCount(0);
      if (scenario === "error") await expect(searchResults.getByRole("alert")).toBeVisible();
      if (scenario === "loading") await expect(searchResults.getByRole("status")).toBeVisible();
      if (scenario === "empty") await expect(searchResults.getByRole("status")).toContainText("0");
      if (scenario !== "empty") {
        await page.locator("[storyPreview] [data-complete-preview]").click();
        await businessSearch.focus();
        await expect(searchResults.locator("li")).toHaveCount(4);
      }
      await closeSearch();
    }
    await page.locator("[storyControls] select").selectOption("ready");
    await businessSearch.fill(text.examples.firstName);
    await expect(searchResults.locator("li")).toHaveCount(4);
    await capture(page, testInfo, "global-search");
    await closeSearch();

    await openReference(page, "back-office-header");
    const accountHeader = page.locator("[storyPreview] app-back-office-header");
    const accountDrawerTrigger = accountHeader.locator(".navigation-trigger");
    const mobileAccount = await accountDrawerTrigger.isVisible();
    if (mobileAccount) await accountDrawerTrigger.click();
    const accountArea = mobileAccount
      ? page.getByRole("dialog")
      : accountHeader.locator(".sidebar");
    await expect(accountArea.locator(".account summary")).toContainText(text.examples.email);
    await accountArea.locator(".account summary").click();
    const accountLink = accountArea.locator(".account-details a");
    await expect(accountLink).toHaveAttribute(
      "href",
      /\/design\/back-office-header#preview=%2Fbackoffice%2Faccount$/,
    );
    await accountLink.click();
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      "/backoffice/account",
    );
    await expect(page).toHaveURL(/\/design\/back-office-header$/);
    if (mobileAccount) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(accountDrawerTrigger).toBeFocused();
      await accountDrawerTrigger.click();
    }
    await accountArea.locator(".account summary").click();
    await accountArea.locator(".sign-out").click();
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      "/backoffice/sign-out",
    );
    await expect(page).toHaveURL(/\/design\/back-office-header$/);
    if (mobileAccount) {
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(accountDrawerTrigger).toBeFocused();
    }
    const apiLink = accountHeader.locator('[data-reference-destination="/api/docs"]');
    await expect(apiLink).toHaveAttribute("href", /\/design\/back-office-header$/);
    await apiLink.click();
    await expect(page.locator("[storyPreview] [data-preview-destination]")).toContainText(
      "/api/docs",
    );
    await expect(page).toHaveURL(/\/design\/back-office-header$/);
    await page.locator('[storyControls] input[type="checkbox"]').uncheck();
    await expect(accountHeader.locator("app-global-search")).toHaveCount(0);
    await capture(page, testInfo, "client-header");
    for (const scenario of ["loading", "error"]) {
      await page.locator("[storyControls] select").first().selectOption(scenario);
      if (mobileAccount) await accountDrawerTrigger.click();
      await expect(accountArea.locator(".account")).toHaveCount(0);
      if (scenario === "loading") {
        await expect(accountArea.locator('.account-status[role="status"]')).toBeVisible();
        await expect(accountArea.locator(".account-status button")).toHaveCount(0);
      } else {
        await expect(accountArea.locator('.account-status > [role="status"]')).toBeVisible();
        await expect(accountArea.locator(".account-status button")).toHaveCount(2);
        await expect(accountArea.locator(".account-status button").first()).toBeVisible();
      }
      if (mobileAccount) await page.keyboard.press("Escape");
      await page.locator("[storyPreview] [data-complete-preview]").click();
      if (mobileAccount) await accountDrawerTrigger.click();
      if (scenario === "error") await accountArea.locator(".account-status button").first().click();
      await expect(accountArea.locator(".account summary")).toContainText(text.examples.email);
      await expect(accountArea.locator(".account-status")).toHaveCount(0);
      if (mobileAccount) await page.keyboard.press("Escape");
    }

    await openReference(page, "mermaid-diagrams");
    await expect(page.locator(".mermaid svg")).toHaveCount(3);
    await page.locator("[storyControls] select").selectOption("sequence");
    await expect(page.locator("[storyPreview] .mermaid svg")).toHaveCount(1);
    await expect(page.locator("[storyPreview] .mermaid svg title")).toContainText(
      new RegExp(text.sequence, "i"),
    );
    await expect(page.locator(".mermaid-error, .mermaid script, .mermaid iframe")).toHaveCount(0);
    await capture(page, testInfo, "mermaid");
    await page.reload();
    await expect(page.locator('[data-component="mermaid-diagrams"]')).toBeVisible();
    await expect(page.locator(".mermaid svg")).toHaveCount(3);

    await openReference(page, "copy-notice");
    await expect(page.locator("app-copy-notice")).toHaveCount(1);
    await expect(page.locator("[storyPreview] app-copy-notice")).toHaveCount(0);
    await page.locator("#reference-copy-message").fill(text.copyNoticeMessage);
    await page.locator("[storyPreview] button").click();
    await expect(page.locator("app-copy-notice [role='status']")).toHaveText(
      text.copyNoticeMessage,
    );
    await capture(page, testInfo, "copy-notice");
    await expect(page.locator("app-copy-notice [role='status']")).toBeEmpty();

    await openReference(page, "button");
    const controls = page.locator("[storyControls]");
    await controls.getByLabel(text.label, { exact: true }).fill("<img src=x onerror=alert(1)>");
    await controls
      .getByRole("combobox", { name: text.variant, exact: true })
      .selectOption("danger");
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
  } catch (error) {
    failures.push(error);
  } finally {
    if (!page.isClosed()) {
      try {
        await page.unroute("**/*", protect);
      } catch (error) {
        failures.push(error);
      }
    }
    page.off("pageerror", reportError);
    await testInfo.attach("component-reference-safety", {
      body: JSON.stringify({ forbiddenRequests, errors }, null, 2),
      contentType: "application/json",
    });
  }
  if (failures.length > 1) {
    testInfo.annotations.push({ type: "cleanup-error", description: String(failures[1]) });
  }
  if (failures.length > 0) throw failures[0];
}
