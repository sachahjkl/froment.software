import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId, quoteId } from "./fixtures.mjs";

export async function checkCatalogWorkspace(page, testInfo) {
  const archivedId = "01ARZ3NDEKTSV4RRFFQ69G5FB1";
  const createdId = "01ARZ3NDEKTSV4RRFFQ69G5FB0";
  const base = {
    quantityMilli: 1000,
    vatRateBasisPoints: 2000,
    currency: "EUR",
    version: 3,
    archived: false,
  };
  let records = [
    { ...base, id: quoteId, description: "Développement Angular", unitPriceCents: 12500 },
    {
      ...base,
      id: clientId,
      description: "Audit comptable",
      quantityMilli: 10000,
      unitPriceCents: 7500,
      vatRateBasisPoints: 550,
    },
    {
      ...base,
      id: archivedId,
      description: "Ancienne prestation",
      unitPriceCents: 25000,
      archived: true,
    },
  ];
  let failList = true;
  let releaseList;
  let releaseCreate;
  let conflict = true;
  let creations = 0;
  let updates = 0;
  const listPattern = "**/api/catalog";
  const updatePattern = /\/api\/catalog\/[A-Z0-9]+$/;
  const catalog = page.locator("app-catalog");
  const search = catalog.getByRole("searchbox", {
    name: /Rechercher une prestation|Search services/,
  });
  const exportButton = catalog.getByRole("button", {
    name: /Exporter les résultats affichés|Export displayed results/,
  });
  const filterButton = catalog.getByRole("button", { name: /^(Filtres|Filters)( \(1\))?$/ });
  const priceSort = catalog
    .getByRole("columnheader", { name: /Prix unitaire HT|Unit price excluding tax/ })
    .getByRole("button");
  const filterDialog = page.getByRole("dialog", { name: /^(Filtres|Filters)$/ });
  const taxDialog = page.getByRole("dialog", { name: /^(TVA|VAT) \(%\)$/ });
  const taxFilter = taxDialog.getByRole("combobox", {
    name: /Rechercher une option|Search options/,
  });
  const openTaxChoices = async () => {
    await filterButton.press("Enter");
    await expect(filterDialog).toBeVisible();
    await expect(filterDialog.getByRole("menuitem")).toHaveCount(1);
    await expect(filterDialog.getByRole("combobox")).toHaveCount(0);
    const category = filterDialog.getByRole("menuitem", { name: /TVA|VAT/ });
    await expect(category).toBeFocused();
    await category.press("Enter");
    await expect(taxDialog).toBeVisible();
    await expect(filterDialog).not.toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(taxFilter).toBeFocused();
    await expect(taxFilter).toHaveAttribute("aria-expanded", "true");
  };
  await page.route(listPattern, async (route) => {
    if (route.request().method() === "POST") {
      creations++;
      const record = {
        ...route.request().postDataJSON(),
        id: createdId,
        version: 1,
        archived: false,
      };
      await new Promise((resolve) => {
        releaseCreate = resolve;
      });
      records.push(record);
      return route.fulfill({ json: record });
    }
    if (failList) {
      await new Promise((resolve) => {
        releaseList = resolve;
      });
      return route.fulfill({ status: 503, json: { code: "catalog.error" } });
    }
    return route.fulfill({ json: records });
  });
  await page.route(updatePattern, (route) => {
    updates++;
    if (conflict)
      return route.fulfill({
        status: 409,
        json: { _tag: "CatalogItemVersionConflict", code: "catalog.version_conflict" },
      });
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    const previous = records.find((item) => item.id === id);
    const { expectedVersion, ...fields } = route.request().postDataJSON();
    expect(expectedVersion).toBe(previous.version);
    const record = { ...previous, ...fields, version: previous.version + 1 };
    records = records.map((item) => (item.id === id ? record : item));
    return route.fulfill({ json: record });
  });
  try {
    await page.goto("/backoffice/catalogue");
    await expect(page.locator('app-catalog p[role="status"]')).toContainText(/Loading|Chargement/);
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await expect(filterButton).toBeDisabled();
    await exportButton.focus();
    await expect(catalog.locator('[popover="hint"]')).toBeVisible();
    await expect(catalog.locator('[popover="hint"]')).toContainText(/Attendez|Wait for loading/);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: testInfo.outputPath("catalog-loading.png"), fullPage: true });
    releaseList();
    await expect(page.locator('app-catalog [role="alert"]')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("catalog-error.png"), fullPage: true });
    failList = false;
    await page
      .locator("app-catalog")
      .getByRole("button", { name: /Retry|Réessayer/ })
      .click();
    await expect(page.locator("app-catalog tbody tr")).toHaveCount(2);
    await expect(page.locator("app-catalog form, .configuration")).toHaveCount(0);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(exportButton).toHaveAttribute("aria-disabled", "false");
    await search.pressSequentially("developement");
    await expect(search).toBeFocused();
    await expect(page).toHaveURL(/q=developement/);
    await expect(page.locator("app-catalog tbody tr")).toHaveCount(1);
    await expect(page.locator("#catalog-active-tab")).toHaveAttribute("aria-current", "page");
    await page.locator("#catalog-archived-tab").click();
    await expect(page.locator("app-empty-state")).toBeVisible();
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await exportButton.focus();
    await expect(catalog.locator('[popover="hint"]')).toBeVisible();
    await expect(catalog.locator('[popover="hint"]')).toContainText(
      /Aucun résultat|no displayed results/,
    );
    await page.keyboard.press("Escape");
    await page.locator("[appFilterChip]").click();
    await expect(search).toBeFocused();
    await expect(page.locator("app-catalog tbody")).toContainText("Ancienne prestation");
    await page.locator("#catalog-all-tab").click();
    await expect(page.locator("app-catalog tbody tr")).toHaveCount(3);
    await expect(catalog.locator("[appTableSort]")).toHaveCount(5);
    for (const { label, first, last } of [
      {
        label: /Quantité par défaut|Default quantity/,
        first: "Développement Angular",
        last: "Audit comptable",
      },
      { label: /TVA|VAT/, first: "Audit comptable", last: "Développement Angular" },
      { label: /État|Status/, first: "Audit comptable", last: "Ancienne prestation" },
    ]) {
      const header = catalog.getByRole("columnheader", { name: label });
      await header.getByRole("button").click();
      await expect(header).toHaveAttribute("aria-sort", "ascending");
      await expect(catalog.locator("tbody tr").first()).toContainText(first);
      await header.getByRole("button").click();
      await expect(header).toHaveAttribute("aria-sort", "descending");
      await expect(catalog.locator("tbody tr").first()).toContainText(last);
      await expect(catalog.locator("th[aria-sort]")).toHaveCount(1);
    }
    await priceSort.click();
    await expect(page.locator("app-catalog tbody tr").first()).toContainText("Audit comptable");
    await priceSort.click();
    await expect(page.locator("app-catalog tbody tr").first()).toContainText("Ancienne prestation");
    await openTaxChoices();
    await expect(taxDialog.getByRole("option")).toHaveCount(3);
    await expect(taxDialog.getByRole("option", { selected: true })).toHaveText(
      /Tous les taux de TVA|All VAT rates/,
    );
    await taxFilter.pressSequentially("20");
    const twentyPercent = taxDialog.getByRole("option", { name: /^20[,.]00 %$/ });
    await expect(taxDialog.getByRole("option")).toHaveCount(1);
    await expect(twentyPercent).toBeVisible();
    await expect(twentyPercent).toHaveAttribute("aria-selected", "false");
    await expect(page).not.toHaveURL(/tax=/);
    await expect(catalog.locator("tbody tr")).toHaveCount(3);
    await taxFilter.press("Home");
    await expect(taxFilter).toHaveAttribute(
      "aria-activedescendant",
      await twentyPercent.getAttribute("id"),
    );
    await taxFilter.press("Enter");
    await expect(page).toHaveURL(/tax=2000/);
    await expect(catalog.locator("tbody tr")).toHaveCount(2);
    await expect(taxDialog).not.toBeVisible();
    await expect(filterButton).toBeFocused();
    await expect(filterButton).toHaveAccessibleName(/\(1\)$/);
    await openTaxChoices();
    await expect(twentyPercent).toHaveAttribute("aria-selected", "true");
    await expect(taxDialog.getByRole("option", { selected: true })).toHaveCount(1);
    await expect(taxFilter).toHaveValue("");
    await taxFilter.pressSequentially("5");
    const reducedTax = taxDialog.getByRole("option", { name: /^5[,.]50 %$/ });
    await expect(taxDialog.getByRole("option")).toHaveCount(1);
    await expect(reducedTax).toHaveAttribute("aria-selected", "false");
    await taxFilter.press("Home");
    await expect(taxFilter).toHaveAttribute(
      "aria-activedescendant",
      await reducedTax.getAttribute("id"),
    );
    await expect(page).toHaveURL(/tax=2000/);
    await taxFilter.press("Escape");
    await expect(taxDialog).not.toBeVisible();
    await expect(filterButton).toBeFocused();
    await expect(page).toHaveURL(/sort=price-desc&tax=2000$/);
    await expect(catalog.locator("tbody tr")).toHaveCount(2);
    await expect(exportButton).not.toHaveAttribute("title");
    await exportButton.focus();
    await expect(catalog.locator('[popover="hint"]')).toBeVisible();
    await expect(catalog.locator('[popover="hint"]')).toContainText(/Exporter|Export/);
    const downloaded = page.waitForEvent("download");
    await exportButton.click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe("catalog.csv");
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString("utf8");
    const lines = csv
      .replace(/^\uFEFF/, "")
      .trimEnd()
      .split("\r\n");
    const statuses = (await catalog.locator("tbody td:last-child").allTextContents()).map((text) =>
      text.trim(),
    );
    expect(lines).toEqual([
      expect.stringMatching(
        /^"Description","(?:Default quantity|Quantité par défaut)","(?:Unit price excluding tax|Prix unitaire HT) \(EUR\)","(?:VAT|TVA) \(%\)","(?:Status|État)"$/,
      ),
      `"Ancienne prestation","1.000","250.00","20.00","${statuses[0]}"`,
      `"Développement Angular","1.000","125.00","20.00","${statuses[1]}"`,
    ]);
    expect(csv).not.toContain("Audit comptable");
    expect(csv).not.toContain(quoteId);
    await expect(page).toHaveURL(/sort=price-desc&tax=2000$/);
    await search.fill("Angular");
    await expect(catalog.locator("tbody tr")).toHaveCount(1);
    await openTaxChoices();
    await expect(twentyPercent).toHaveAttribute("aria-selected", "true");
    await taxFilter.pressSequentially("5");
    await expect(taxDialog.getByRole("option")).toHaveCount(1);
    await taxFilter.press("Home");
    await expect(taxFilter).toHaveAttribute(
      "aria-activedescendant",
      await reducedTax.getAttribute("id"),
    );
    await taxFilter.press("Enter");
    await expect(catalog.locator("app-empty-state")).toBeVisible();
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await expect(taxDialog).not.toBeVisible();
    await expect(filterButton).toBeFocused();
    await expect(page).toHaveURL(/q=Angular&sort=price-desc&tax=550$/);
    await catalog.getByRole("button", { name: /(?:Retirer|Remove).*?(?:TVA|VAT)/ }).click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("Angular");
    await expect(page).not.toHaveURL(/tax=/);
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(catalog.locator("tbody tr")).toHaveCount(1);
    await catalog.locator("[appFilterChip]").click();
    await expect(search).toBeFocused();
    await expect(catalog.locator("tbody tr")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    if (page.viewportSize().width >= 1024) {
      expect(
        await page
          .locator("app-catalog [appDataTable]")
          .evaluate((node) => node.scrollWidth > node.clientWidth),
      ).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath("catalog-list.png"), fullPage: true });
    const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme === "dark" ? "light" : "dark";
    }, originalTheme);
    await page.screenshot({
      path: testInfo.outputPath("catalog-list-other-theme.png"),
      fullPage: true,
    });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, originalTheme);
    const listAudit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(listAudit.violations).toEqual([]);
    await page.locator("#catalog-active-tab").click();
    await search.fill("Angular");
    await openTaxChoices();
    await taxFilter.pressSequentially("20");
    await expect(taxDialog.getByRole("option")).toHaveCount(1);
    await taxFilter.press("Home");
    await expect(taxFilter).toHaveAttribute(
      "aria-activedescendant",
      await twentyPercent.getAttribute("id"),
    );
    await taxFilter.press("Enter");
    await expect(taxDialog).not.toBeVisible();
    await expect(filterButton).toBeFocused();
    await expect(page).toHaveURL(/q=Angular&sort=price-desc&tax=2000$/);
    await page.locator("app-catalog tbody a").click();
    await expect(page.locator("#catalog-description")).toHaveValue("Développement Angular");
    await page.locator("#catalog-price").fill("150.01");
    await page.locator(".catalog-form .actions a").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#catalog-price")).toHaveValue("150.01");
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page.locator('app-catalog-editor [role="alert"]')).toBeVisible();
    await expect(page.locator("#catalog-price")).toHaveValue("150.01");
    await page.screenshot({ path: testInfo.outputPath("catalog-conflict.png"), fullPage: true });
    conflict = false;
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page).toHaveURL(/catalogue\/active\?q=Angular&sort=price-desc&tax=2000$/);
    await expect(catalog.locator("[appFilterChip]")).toHaveCount(2);
    await expect(page.locator('app-catalog [appNotice][role="status"]')).toBeVisible();
    expect(updates).toBe(2);
    await page.locator("app-catalog tbody a").click();
    await page.locator('.catalog-form [type="checkbox"]').check();
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(updates).toBe(2);
    await expect(page.locator('.catalog-form [type="submit"]')).toBeFocused();
    await page.locator('.catalog-form [type="submit"]').click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Confirm|Confirmer)$/ })
      .click();
    await expect(page.locator("app-empty-state")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("catalog-no-matches.png"), fullPage: true });
    await page.locator("#catalog-archived-tab").click();
    await page.locator("app-catalog tbody a").click();
    await page.locator('.catalog-form [type="checkbox"]').uncheck();
    await page.locator('.catalog-form [type="submit"]').click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Confirm|Confirmer)$/ })
      .click();
    await expect(page).toHaveURL(/catalogue\/archived\?q=Angular&sort=price-desc&tax=2000$/);
    await catalog.getByRole("button", { name: /(?:Retirer|Remove).*?(?:TVA|VAT)/ }).click();
    await expect(search).toBeFocused();
    await page.locator("app-catalog app-page-header a").click();
    await expect(page).toHaveURL(/catalogue\/new\?.*view=archived/);
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page.locator("#catalog-description")).toBeFocused();
    await expect(page.locator("#catalog-description")).toHaveAttribute("aria-invalid", "true");
    await page.locator("#catalog-description").fill("Nouvelle prestation Angular");
    await page.locator("#catalog-quantity").fill("0");
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page.locator("#catalog-quantity")).toBeFocused();
    await page.locator("#catalog-quantity").fill("1.125");
    await page.locator("#catalog-price").fill("125.01");
    await page.locator("#catalog-tax").fill("5.50");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("catalog-create.png"), fullPage: true });
    const formAudit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(formAudit.violations).toEqual([]);
    await page.locator('.catalog-form [type="submit"]').click();
    await expect(page.locator("#catalog-description")).toBeDisabled();
    await expect.poll(() => creations).toBe(1);
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(true);
    releaseCreate();
    await expect(page).toHaveURL(/catalogue\/archived\?q=Angular&sort=price-desc$/);
    expect(creations).toBe(1);
    await page.locator("#catalog-active-tab").click();
    await expect(page.locator("app-catalog tbody tr")).toHaveCount(2);
    await page.reload();
    await expect(search).toHaveValue("Angular");
    await expect(page.locator("th[aria-sort='descending']")).toBeVisible();
    await page.goto("/design/data");
    await page.waitForLoadState("networkidle");
    await page.locator("[appTableSort]").click();
    await expect(page.locator("#design-data-panel tbody tr").first()).toContainText("Web");
    await page.locator('app-list-toolbar input[type="search"]').fill("Angular");
    await expect(page.locator("#design-data-panel tbody tr")).toHaveCount(1);
    await page.locator("[appFilterChip]").click();
    await expect(page.locator("#design-data-panel tbody tr")).toHaveCount(2);
    await page.screenshot({
      path: testInfo.outputPath("catalog-controls-demo.png"),
      fullPage: true,
    });
  } finally {
    await page.unroute(listPattern);
    await page.unroute(updatePattern);
  }
}
