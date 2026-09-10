import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { designWorkspaceText } from "../../packages/l10n/src/design-workspace.ts";
import { checkComponentReference } from "./component-reference.mjs";

const workflowPath = "/design/workflows";

async function referenceLink(page, id) {
  const sidebar = page.locator(".reference-sidebar");
  if (await sidebar.isVisible()) return sidebar.locator(`[data-reference-link="${id}"]`);
  await page.locator(".reference-mobile-header button").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.locator("[data-drawer-close]")).toBeFocused();
  return drawer.locator(`[data-reference-link="${id}"]`);
}

async function capture(page, testInfo, name) {
  await page.screenshot({
    path: testInfo.outputPath(`design-workspace-${name}.png`),
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const workspace = page.locator("app-design-workspace [appListWorkspace]");
  if (await workspace.count()) {
    const spacing = await workspace.evaluate((element) => {
      const visible = [...element.children].filter((child) => child.getClientRects().length > 0);
      const margins = [...element.querySelectorAll("app-list-toolbar, [appDataTable]")].map(
        (child) => {
          const style = getComputedStyle(child);
          return {
            element: child.tagName,
            start: parseFloat(style.marginBlockStart),
            end: parseFloat(style.marginBlockEnd),
          };
        },
      );
      return {
        gap: parseFloat(getComputedStyle(element).rowGap),
        margins,
        distances: visible
          .slice(1)
          .map(
            (child, index) =>
              child.getBoundingClientRect().top - visible[index].getBoundingClientRect().bottom,
          ),
      };
    });
    expect(spacing.gap).toBe(16);
    for (const margin of spacing.margins) {
      expect(margin.start, `${margin.element}: start margin`).toBe(0);
      expect(margin.end, `${margin.element}: end margin`).toBe(0);
    }
    for (const distance of spacing.distances) expect(Math.abs(distance - 16)).toBeLessThan(1);
  }
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations, `Accessibility: design workspace ${name}`).toEqual([]);
}

async function setStatus(page, text, value) {
  const trigger = page.locator("app-design-workspace app-filter-menu > button");
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName(text.filters);
  await expect(dialog.getByRole("menuitem")).toBeFocused();
  await dialog.getByRole("menuitem").click();
  await expect(dialog.locator("#workspace-status input")).toBeFocused();
  const label = value === "draft" ? text.draft : value === "ready" ? text.ready : text.allStates;
  await dialog
    .getByRole("option")
    .filter({ has: page.locator(".option-label", { hasText: label }) })
    .click();
  await expect(dialog.getByRole("menuitem")).toBeFocused();
  await dialog.getByRole("button", { name: text.closeFilters, exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(dialog).toHaveCount(0);
}

async function downloadCsv(page) {
  const button = page.locator("app-design-workspace app-table-export button");
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("design-workspace.csv");
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  expect(path).not.toBeNull();
  const content = await readFile(path, "utf8");
  await page.keyboard.press("Escape");
  return content;
}

function csvHeader(text) {
  return `\uFEFF"${text.reference}","${text.name}","${text.contact}","${text.status}"\r\n`;
}

async function unloadPrevented(page) {
  return page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

async function checkSearchAndFilters(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const search = workspace.locator("#workspace-search input");
  const filters = workspace.locator("app-filter-menu > button");
  const chips = workspace.locator("[appFilterChip]");
  await search.fill("atls");
  await expect(search).toBeFocused();
  await expect(workspace.locator("tbody tr")).toHaveCount(1);
  await expect(workspace.locator("tbody th[scope='row']")).toHaveText("Atlas");
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–1.*1/);
  await expect
    .poll(() => page.evaluate(() => CSS.highlights.get("search-match")?.size ?? 0))
    .toBeGreaterThan(0);
  await capture(page, testInfo, "search");
  const filteredCsv =
    csvHeader(text) + `"DEMO-1","Atlas","contact1@example.com","${text.draft}"\r\n`;
  expect(await downloadCsv(page)).toBe(filteredCsv);
  await workspace.getByRole("checkbox", { name: `${text.select} Atlas`, exact: true }).check();
  await expect(workspace.locator("app-table-export button")).toHaveAccessibleName(
    text.exportSelection,
  );
  expect(await downloadCsv(page)).toBe(filteredCsv);
  await workspace.getByRole("button", { name: text.clearSelection, exact: true }).click();

  await setStatus(page, text, "ready");
  await expect(workspace.locator("app-empty-state")).toContainText(text.noMatch);
  await expect(chips).toHaveCount(2);
  await expect(workspace.locator("app-result-navigation")).toContainText(/0–0.*0/);
  await chips.filter({ hasText: text.ready }).click();
  await expect(filters).toBeFocused();
  await expect(workspace.locator("tbody tr")).toHaveCount(1);
  await chips.click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");

  await setStatus(page, text, "draft");
  await expect(workspace.locator("tbody th[scope='row']")).toHaveText([
    "Atlas",
    "Cobalt",
    "Équinoxe",
  ]);
  await expect(workspace.locator("tbody [appBadge]")).toHaveText(Array(3).fill(text.draft));
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–3.*3/);
  await chips.click();
  await expect(filters).toHaveAccessibleName(text.filters);
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–3.*6/);
}

async function checkSortAndPagination(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const sort = workspace.locator("[appTableSort]");
  const names = workspace.locator("tbody th[scope='row']");
  const previous = workspace.getByRole("button", { name: text.previous, exact: true });
  const next = workspace.getByRole("button", { name: text.next, exact: true });
  await expect(previous).toBeDisabled();
  await sort.click();
  await expect(workspace.locator("th[aria-sort]")).toHaveAttribute("aria-sort", "descending");
  await expect(names).toHaveText(["Orion", "Équinoxe", "Delta"]);
  expect(await downloadCsv(page)).toBe(
    csvHeader(text) +
      `"DEMO-6","Orion","contact6@example.com","${text.ready}"\r\n` +
      `"DEMO-5","Équinoxe","contact5@example.com","${text.draft}"\r\n` +
      `"DEMO-4","Delta","contact4@example.com","${text.ready}"\r\n` +
      `"DEMO-3","Cobalt","contact3@example.com","${text.draft}"\r\n` +
      `"DEMO-2","Boréal","contact2@example.com","${text.ready}"\r\n` +
      `"DEMO-1","Atlas","contact1@example.com","${text.draft}"\r\n`,
  );
  await workspace.getByRole("checkbox", { name: text.selectPage, exact: true }).check();
  await next.click();
  await expect(workspace.locator("app-bulk-selection")).toBeHidden();
  await expect(names).toHaveText(["Cobalt", "Boréal", "Atlas"]);
  await expect(workspace.locator("app-result-navigation")).toContainText(/4–6.*6/);
  await expect(next).toBeDisabled();
  await expect(previous).toBeEnabled();
  await expect(workspace.getByRole("heading", { name: text.list, exact: true })).toBeFocused();
  await capture(page, testInfo, "pagination");

  await previous.click();
  await expect(names).toHaveText(["Orion", "Équinoxe", "Delta"]);
  await sort.click();
  await expect(workspace.locator("th[aria-sort]")).toHaveAttribute("aria-sort", "ascending");
  await expect(names).toHaveText(["Atlas", "Boréal", "Cobalt"]);
  await expect(previous).toBeDisabled();
}

async function checkSelectionAndBulkActions(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const selection = workspace.locator("app-bulk-selection");
  const selectPage = workspace.getByRole("checkbox", { name: text.selectPage, exact: true });
  await expect(selection).toBeHidden();
  await workspace.getByRole("checkbox", { name: `${text.select} Atlas`, exact: true }).check();
  await expect(selection).toContainText(`${text.selected} : 1`);
  expect(await selectPage.evaluate((input) => input.indeterminate)).toBe(true);
  await workspace.getByRole("checkbox", { name: `${text.select} Atlas`, exact: true }).uncheck();
  await workspace.getByRole("checkbox", { name: `${text.select} Cobalt`, exact: true }).check();
  await workspace.getByRole("checkbox", { name: `${text.select} Atlas`, exact: true }).check();
  expect(await downloadCsv(page)).toBe(
    csvHeader(text) +
      `"DEMO-1","Atlas","contact1@example.com","${text.draft}"\r\n` +
      `"DEMO-3","Cobalt","contact3@example.com","${text.draft}"\r\n`,
  );
  await selectPage.check();
  await expect(selection).toContainText(`${text.selected} : 3`);
  await capture(page, testInfo, "selection");

  await selection.getByRole("button", { name: text.bulkReady, exact: true }).click();
  await expect(selection).toBeHidden();
  await expect(workspace.locator("#workspace-search input")).toBeFocused();
  await expect(workspace.locator("tbody [appBadge]")).toHaveText(Array(3).fill(text.ready));
  await expect(workspace.locator(".feedback")).toHaveText(text.updated);

  await selectPage.check();
  await expect(selection.getByRole("button", { name: text.bulkReady, exact: true })).toBeDisabled();
  await selection.getByRole("button", { name: text.clearSelection, exact: true }).click();
  await expect(selection).toBeHidden();
  await workspace.getByRole("checkbox", { name: `${text.select} Cobalt`, exact: true }).check();
  const remove = selection.getByRole("button", { name: text.bulkRemove, exact: true });
  await remove.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(text.confirmRemove);
  await expect(dialog.locator("[data-confirmation-cancel]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(remove).toBeFocused();
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–3.*6/);
  await remove.click();
  await dialog.getByRole("button", { name: text.remove, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–3.*5/);
  await expect(workspace.locator("tbody th[scope='row']")).toHaveText(["Atlas", "Boréal", "Delta"]);
  await expect(workspace.locator(".feedback")).toHaveText(text.removed);
}

async function checkMenuKeyboard(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const help = workspace.getByRole("button", { name: text.selectionHelp, exact: true });
  const hint = workspace.locator("app-hint[listSummary] [role='tooltip']");
  await expect(hint).toHaveAttribute("popover", "hint");
  await expect(help).toHaveAttribute("aria-describedby", await hint.getAttribute("id"));
  await expect(help).not.toHaveAttribute("title");
  await help.hover();
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(text.selectionHint);
  await hint.hover();
  await expect(hint).toBeVisible();
  expect(await hint.evaluate((element) => getComputedStyle(element).positionAnchor)).toBe(
    await hint.locator("..").evaluate((element) => getComputedStyle(element).anchorName),
  );
  await capture(page, testInfo, "selection-hint");
  await page.keyboard.press("Escape");
  await expect(hint).toBeHidden();
  await page.mouse.move(0, 0);
  const exportButton = workspace.locator("app-table-export button");
  await exportButton.focus();
  await exportButton.press("Tab");
  await expect(help).toBeFocused();
  await expect(hint).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(hint).toBeHidden();
  await expect(help).toBeFocused();
  const trigger = workspace.getByRole("button", { name: `${text.rowActions} Atlas`, exact: true });
  const menu = page.getByRole("menu", { name: `${text.rowActions} Atlas`, exact: true });
  await trigger.focus();
  await trigger.press("ArrowDown");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem", { name: text.edit, exact: true })).toBeFocused();
  await expect(menu.getByRole("menuitem", { name: text.markReady, exact: true })).toBeDisabled();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: text.markReady, exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: text.markReady, exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: text.remove, exact: true })).toBeFocused();
  await capture(page, testInfo, "menu");
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(workspace.locator("#workspace-name")).toHaveValue("Atlas");
  await expect(workspace.getByRole("heading", { name: text.editor, exact: true })).toBeFocused();
  await workspace.getByRole("button", { name: text.cancel, exact: true }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(workspace.locator("tbody tr")).toHaveCount(3);
}

async function checkDetailAndInvalidForm(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  await workspace.getByRole("button", { name: "Atlas", exact: true }).click();
  await expect(workspace.getByRole("heading", { name: "Atlas", exact: true })).toBeFocused();
  await expect(workspace.locator("form, input, textarea, select")).toHaveCount(0);
  await expect(workspace.locator("dl")).toContainText("contact1@example.com");
  await expect(workspace.locator("app-event-history li")).toHaveCount(2);
  await expect(workspace.locator("app-breadcrumbs [aria-current='page']")).toHaveText(text.detail);
  await capture(page, testInfo, "detail");

  await workspace.getByRole("button", { name: text.edit, exact: true }).click();
  await workspace.locator("#workspace-name").fill("");
  await workspace.locator("#workspace-contact").fill("invalid-email");
  const submit = workspace.locator('button[type="submit"]');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(workspace.locator("#workspace-name")).toBeFocused();
  await expect(workspace.locator("#workspace-name")).toHaveAttribute("aria-invalid", "true");
  await expect(workspace.locator("#workspace-name")).toHaveAttribute(
    "aria-describedby",
    "workspace-name-error",
  );
  await expect(workspace.locator("#workspace-name-error")).toHaveText(text.nameError);
  await expect(workspace.locator("#workspace-contact-error")).toHaveText(text.emailError);
  await capture(page, testInfo, "invalid-form");
}

async function checkLinesAndLocalApply(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const submit = workspace.locator('button[type="submit"]');
  await workspace.locator("#workspace-name").fill("Atlas");
  await workspace.locator("#workspace-contact").fill("contact1@example.com");
  await workspace.locator("#workspace-quantity-0").fill("0");
  await submit.click();
  await expect(workspace.locator("#workspace-quantity-0")).toBeFocused();
  await expect(workspace.locator("#workspace-quantity-error-0")).toHaveText(text.quantityError);
  await workspace.locator("#workspace-quantity-0").fill("1,500");
  await workspace.locator("#workspace-price-0").fill("19.99");
  await expect(workspace.locator(".line-total").first()).toContainText(/29[,.]99 €/);
  await expect(workspace.locator(".sum")).toContainText(/160[,.]99 €/);

  await workspace.getByRole("button", { name: text.addLine, exact: true }).click();
  await expect(workspace.locator("#workspace-line-name-2")).toBeFocused();
  await workspace.locator("#workspace-line-name-2").fill("Audit");
  await workspace.locator("#workspace-quantity-2").fill("0.001");
  await workspace.locator("#workspace-price-2").fill("5,00");
  await expect(workspace.locator(".line-total").last()).toContainText(/0[,.]01 €/);
  await expect(workspace.locator(".sum")).toContainText(/161[,.]00 €/);
  await workspace.getByRole("button", { name: `${text.removeLine} 3`, exact: true }).click();
  await expect(workspace.locator("#workspace-line-name-1")).toBeFocused();
  await expect(workspace.locator(".line-editor")).toHaveCount(2);
  await expect(workspace.locator(".sum")).toContainText(/160[,.]99 €/);

  await workspace.locator("#workspace-price-0").fill("19.999");
  await expect(workspace.locator(".sum")).toHaveCount(0);
  await expect(workspace.locator(".summary")).toContainText(text.previewInvalid);
  await submit.click();
  await expect(workspace.locator("#workspace-price-0")).toBeFocused();
  await workspace.locator("#workspace-price-0").fill("19,99");
  await expect(workspace.locator("#workspace-summary")).toHaveText(text.preview);
  expect(await unloadPrevented(page)).toBe(true);
  await capture(page, testInfo, "line-summary");
  await submit.click();
  await expect(workspace.locator("form")).toHaveCount(0);
  await expect(workspace.locator(".feedback")).toHaveText(text.saved);
  await expect(workspace.locator("app-event-history li")).toHaveCount(3);
  await expect(workspace.locator(".summary")).toHaveCount(0);
  expect(await unloadPrevented(page)).toBe(false);

  await workspace.getByRole("button", { name: text.back, exact: true }).click();
  await workspace.getByRole("button", { name: text.createVariants, exact: true }).click();
  await page.getByRole("menuitem", { name: text.createExample, exact: true }).click();
  await expect(workspace.locator("#workspace-name")).toHaveValue("Nova");
  await workspace.locator("#workspace-name").fill("=1+1");
  await expect(workspace.locator(".line-editor")).toHaveCount(2);
  await expect(workspace.locator(".sum")).toContainText(/266[,.]00 €/);
  await submit.click();
  await expect(workspace.locator(".detail-values")).toContainText("=1+1");
  await expect(workspace.locator(".feedback")).toHaveText(text.saved);
  await workspace.getByRole("button", { name: text.back, exact: true }).click();
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–3.*6/);
  await workspace.locator("#workspace-search input").fill("=1+1");
  await expect(workspace.locator("tbody tr")).toHaveCount(1);
  expect(await downloadCsv(page)).toBe(
    csvHeader(text) + `"DEMO-7","'=1+1","contact@example.com","${text.draft}"\r\n`,
  );
  await workspace.locator("[appFilterChip]").click();
}

async function checkChildRouteGuard(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const dialog = page.getByRole("alertdialog");
  await workspace.getByRole("button", { name: text.create, exact: true }).click();
  expect(await unloadPrevented(page)).toBe(false);
  await workspace.locator("#workspace-name").fill("Unsaved workflow");
  expect(await unloadPrevented(page)).toBe(true);
  const otherTab = await referenceLink(page, "button");
  await otherTab.click();
  await expect(dialog).toContainText(text.discard);
  await expect(dialog.locator("[data-confirmation-cancel]")).toBeFocused();
  await capture(page, testInfo, "tab-guard");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(otherTab).toBeFocused();
  await expect(page).toHaveURL(/\/design\/workflows$/);
  await expect(
    page.locator('.reference-sidebar [data-reference-link="workflows"]'),
  ).toHaveAttribute("aria-current", "page");
  await expect(workspace.locator("#workspace-name")).toHaveValue("Unsaved workflow");
  await otherTab.click();
  await dialog.getByRole("button", { name: text.discardLabel, exact: true }).click();
  await expect(page).toHaveURL(/\/design\/button$/);
  await expect(workspace).toHaveCount(0);
  expect(await unloadPrevented(page)).toBe(false);

  await (await referenceLink(page, "workflows")).click();
  await expect(workspace.locator("tbody th[scope='row']")).toHaveText([
    "Atlas",
    "Boréal",
    "Cobalt",
  ]);
  await workspace.getByRole("button", { name: text.create, exact: true }).click();
  await workspace.locator("#workspace-name").fill("Unsaved page change");
  const otherPage = page.locator('app-site-footer a[href="/legal"]');
  await otherPage.click();
  await expect(dialog).toContainText(text.discard);
  await expect(dialog.locator("[data-confirmation-cancel]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(otherPage).toBeFocused();
  await expect(page).toHaveURL(/\/design\/workflows$/);
  await expect(workspace.locator("#workspace-name")).toHaveValue("Unsaved page change");
  expect(await unloadPrevented(page)).toBe(true);
  await otherPage.click();
  await dialog.getByRole("button", { name: text.discardLabel, exact: true }).click();
  await expect(page).toHaveURL(/\/legal$/);
  await expect(workspace).toHaveCount(0);
  expect(await unloadPrevented(page)).toBe(false);
  await page.goBack();
  await expect(page).toHaveURL(/\/design\/workflows$/);
  await expect(workspace.locator("tbody tr")).toHaveCount(3);
}

async function checkSimulatedStates(page, text, testInfo) {
  const workspace = page.locator("app-design-workspace");
  const state = workspace.locator("#workspace-scenario");
  await state.selectOption("loading");
  await expect(workspace.locator(".state[role='status']")).toHaveText(text.loading);
  await expect(workspace.locator("table")).toHaveCount(0);
  await expect(workspace.locator("app-list-toolbar [role='status']")).toHaveText(
    text.scenarios.loading,
  );
  const exportButton = workspace.locator("app-table-export button");
  const exportHint = workspace.locator("app-table-export [role='tooltip']");
  await expect(exportButton).toBeDisabled();
  await exportButton.focus();
  await expect(exportButton).toBeFocused();
  await expect(exportHint).toBeVisible();
  await expect(exportHint).toHaveText(text.exportPending);
  await page.keyboard.press("Escape");
  await expect(exportHint).toBeHidden();
  await capture(page, testInfo, "loading");

  await state.selectOption("error");
  await expect(workspace.locator("app-empty-state")).toContainText(text.error);
  await expect(workspace.locator("table")).toHaveCount(0);
  await expect(exportButton).toBeDisabled();
  await expect(exportHint).toHaveText(text.exportEmpty);
  await capture(page, testInfo, "error");
  await workspace.getByRole("button", { name: text.retry, exact: true }).click();
  await expect(state).toHaveValue("ready");
  await expect(workspace.locator("tbody tr")).toHaveCount(3);

  await state.selectOption("empty");
  await expect(workspace.locator("app-empty-state")).toContainText(text.empty);
  await expect(workspace.locator("table")).toHaveCount(0);
  await capture(page, testInfo, "empty");

  await state.selectOption("noMatch");
  await expect(workspace.locator("app-empty-state")).toContainText(text.noMatch);
  await expect(workspace.locator("app-result-navigation")).toContainText(/0–0.*0/);
  await expect(workspace.getByRole("button", { name: text.previous, exact: true })).toBeDisabled();
  await expect(workspace.getByRole("button", { name: text.next, exact: true })).toBeDisabled();
  await capture(page, testInfo, "no-match");
  await workspace.getByRole("button", { name: text.resetFilters, exact: true }).click();
  await expect(state).toHaveValue("ready");
  await expect(workspace.locator("tbody tr")).toHaveCount(3);
  await workspace.locator("#workspace-search input").fill("zzzzzzzzzz");
  await expect(workspace.locator("app-empty-state")).toContainText(text.noMatch);
  await workspace.getByRole("button", { name: text.resetFilters, exact: true }).click();
  await expect(workspace.locator("#workspace-search input")).toBeFocused();
  await expect(workspace.locator("app-result-navigation")).toContainText(/1–3.*6/);
  await capture(page, testInfo, "ready");
}

export async function checkDesignWorkspace(page, testInfo) {
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  await checkComponentReference(page, testInfo);
  await page.goto(workflowPath);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("app-design-workspace tbody tr")).toHaveCount(3);
  const language = await page.locator("html").getAttribute("lang");
  expect(["fr", "en"]).toContain(language);
  const text = designWorkspaceText[language];
  await page.evaluate((theme) => {
    if (theme === null) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, originalTheme);

  await checkSearchAndFilters(page, text, testInfo);
  await checkSortAndPagination(page, text, testInfo);
  await checkSelectionAndBulkActions(page, text, testInfo);
  await checkMenuKeyboard(page, text, testInfo);
  await checkDetailAndInvalidForm(page, text, testInfo);
  await checkLinesAndLocalApply(page, text, testInfo);
  await checkChildRouteGuard(page, text, testInfo);
  await checkSimulatedStates(page, text, testInfo);
}
