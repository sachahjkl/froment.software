import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { serializeCsv } from "../../packages/web/src/app/shared/table-export/csv.ts";
import { client, clientId, quoteId } from "./fixtures.mjs";

// Call after the parent installs mockApi(page) in administrator mode.
// Use the existing desktop/mobile projects and a 180-second test timeout.
export async function checkCommercialWorkspace(page, testInfo) {
  const theme = testInfo.project.use.colorScheme;
  expect(["light", "dark"]).toContain(theme);
  const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  const setTheme = (value) =>
    page.evaluate((value) => {
      if (value === undefined) delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = value;
    }, value);
  async function capture(name, { audit = true, colorScheme = theme } = {}) {
    await setTheme(colorScheme);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main > router-outlet + *")).toHaveClass(/page-container/);
    await expect(page.locator("main")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
    if (audit) {
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(result.violations, name).toEqual([]);
    }
  }
  const confirmation = page.getByRole("alertdialog");
  async function acceptConfirmation() {
    await expect(confirmation).toBeVisible();
    await confirmation.locator("button:not([data-confirmation-cancel])").click();
    await expect(confirmation).toHaveCount(0);
  }
  async function rejectConfirmation(trigger) {
    await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  async function expectUnloadProtection(expected) {
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(expected);
  }
  const context = {
    q: "Audit",
    stage: "draft",
    client: clientId,
    view: "all",
    sort: "amount-desc",
  };
  async function expectContext(pathname) {
    await expect(page).toHaveURL((url) => url.pathname === pathname);
    const params = new URL(page.url()).searchParams;
    for (const [key, value] of Object.entries(context)) expect(params.get(key), key).toBe(value);
    expect(params.has("returnUrl")).toBe(false);
  }

  // Read the parent's private quote/order fixtures through its installed routes.
  const [quoteResponse, ordersResponse] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === `/api/quotes/${quoteId}`,
    ),
    page.waitForResponse((response) => new URL(response.url()).pathname === "/api/orders"),
    page.goto(`/backoffice/quotes/${quoteId}`),
  ]);
  expect(quoteResponse.ok()).toBe(true);
  expect(ordersResponse.ok()).toBe(true);
  const baseQuote = await quoteResponse.json();
  const baseOrder = (await ordersResponse.json()).find((order) => order.quoteId === quoteId);
  expect(baseOrder).toBeDefined();
  expect(baseQuote.status).toBe("draft");
  await expect(page.locator("app-quote-detail h1")).toHaveText(baseQuote.currentRevision.title);
  const acceptedRevision = baseQuote.revisions.find(
    (revision) => revision.id === baseOrder.revisionId,
  );
  expect(acceptedRevision).toBeDefined();
  const currentRevision = {
    ...baseQuote.currentRevision,
    id: "01ARZ3NDEKTSV4RRFFQ69G5FB4",
    version: baseQuote.version + 1,
    lines: baseQuote.currentRevision.lines.map((line, index) =>
      index === 0
        ? { ...line, description: "Version courante uniquement / Current revision only" }
        : line,
    ),
  };
  let quote = {
    ...baseQuote,
    version: currentRevision.version,
    currentRevision,
    revisions: [...baseQuote.revisions, currentRevision],
  };
  const order = { ...baseOrder, invoiceId: null };
  const otherClient = { ...client, id: "01ARZ3NDEKTSV4RRFFQ69G5FB2", displayName: "Boreal" };
  const catalogItem = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FB5",
    description: "Inspection des équipements / Equipment inspection",
    quantityMilli: 1500,
    unitPriceCents: 8000,
    vatRateBasisPoints: 2000,
    currency: "EUR",
    version: 1,
    archived: false,
  };
  const preset = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FB6",
    name: "Forfait inspection / Inspection conditions",
    conditions: "Payment within 30 days. ".repeat(30),
  };
  const artifact = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FB7",
    quoteReference: quote.reference,
    revisionId: currentRevision.id,
    kind: "quote-pdf",
    contentType: "application/pdf",
    byteSize: 120,
    sha256: "a".repeat(64),
    createdAt: currentRevision.createdAt,
  };
  let listState = "loading";
  let detailUnavailable = false;
  let orderVisible = false;
  let missingAcceptedRevision = false;
  const listGate = Promise.withResolvers();
  const revisionGate = Promise.withResolvers();
  const publicationGate = Promise.withResolvers();
  const revisionRequests = [];
  const publicationRequests = [];
  const pdfRequests = [];
  const unexpectedWrites = [];
  const activeRoutes = new Set();
  const apiPattern = "**/api/**";
  async function respond(route) {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method === "GET") {
      if (path === "/api/quotes") {
        if (listState === "loading") {
          await listGate.promise;
          return route.fulfill({ status: 503, json: {} });
        }
        const summary = {
          id: quoteId,
          reference: quote.reference,
          clientId,
          clientDisplayName: client.displayName,
          status: quote.status,
          version: quote.version,
          title: currentRevision.title,
          currency: "EUR",
          totalCents: currentRevision.totalCents,
          updatedAt: currentRevision.createdAt,
        };
        return route.fulfill({
          json:
            listState === "empty"
              ? []
              : [
                  summary,
                  {
                    ...summary,
                    id: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
                    reference: "DE-2026-000002",
                    clientId: otherClient.id,
                    clientDisplayName: otherClient.displayName,
                    title: "Maintenance annuelle / Annual maintenance",
                    status: "rejected",
                    totalCents: 90000,
                    updatedAt: "2026-01-31T12:00:00.000Z",
                  },
                ],
        });
      }
      if (path === `/api/quotes/${quoteId}`)
        return detailUnavailable
          ? route.fulfill({ status: 503, json: {} })
          : route.fulfill({
              json: missingAcceptedRevision ? { ...quote, revisions: [currentRevision] } : quote,
            });
      if (path === "/api/orders") return route.fulfill({ json: orderVisible ? [order] : [] });
      if (path === "/api/invoices") return route.fulfill({ json: [] });
      if (path === "/api/clients") return route.fulfill({ json: [client, otherClient] });
      if (path === "/api/catalog")
        return route.fulfill({
          json: [
            catalogItem,
            {
              ...catalogItem,
              id: "01ARZ3NDEKTSV4RRFFQ69G5FB8",
              description: "Formation / Training",
            },
            {
              ...catalogItem,
              id: "01ARZ3NDEKTSV4RRFFQ69G5FB9",
              archived: true,
            },
          ],
        });
      if (path === "/api/quote-condition-presets")
        return route.fulfill({
          json: [
            preset,
            {
              ...preset,
              id: "01ARZ3NDEKTSV4RRFFQ69G5FBA",
              name: "Formation / Training",
              conditions: "Other conditions.",
            },
          ],
        });
    }
    if (method === "POST" && path === `/api/quotes/${quoteId}/revisions`) {
      revisionRequests.push(request.postDataJSON());
      await revisionGate.promise;
      return route.fulfill({
        status: 409,
        json: {
          _tag: "QuoteVersionConflict",
          code: "quote.version_conflict",
          currentVersion: quote.version + 1,
        },
      });
    }
    if (method === "POST" && path === `/api/quotes/${quoteId}/revisions/${quote.version}/pdf`) {
      pdfRequests.push(path);
      return route.fulfill({ json: artifact });
    }
    if (method === "POST" && path === `/api/orders/${order.id}/pdf`) {
      pdfRequests.push(path);
      return route.fulfill({
        json: {
          id: artifact.id,
          kind: "order-pdf",
          orderId: order.id,
          orderReference: order.reference,
          contentType: artifact.contentType,
          byteSize: artifact.byteSize,
          sha256: artifact.sha256,
          createdAt: artifact.createdAt,
        },
      });
    }
    if (method === "POST" && path === `/api/quotes/${quoteId}/send`) {
      publicationRequests.push(request.postDataJSON());
      if (publicationRequests.length === 1)
        return route.fulfill({
          status: 409,
          json: {
            _tag: "DocumentIncomplete",
            code: "document.incomplete",
            issues: [{ party: "client", field: "email", reason: "invalid_email" }],
          },
        });
      await publicationGate.promise;
      quote = { ...quote, status: "sent" };
      return route.fulfill({ status: 503, json: {} });
    }
    // Never send a business write to the server or the parent's permissive fixture map.
    if (
      !["GET", "HEAD"].includes(method) &&
      !["/api/auth/refresh", "/api/auth/login"].includes(path)
    ) {
      unexpectedWrites.push({ method, path });
      return route.fulfill({ status: 409, json: {} });
    }
    return route.fallback();
  }
  async function handler(route) {
    const response = respond(route);
    activeRoutes.add(response);
    try {
      await response;
    } finally {
      activeRoutes.delete(response);
    }
  }
  await page.route(apiPattern, handler);
  testInfo.annotations.push({
    type: "commercial",
    description: "Preview HTML and all business writes use mocks.",
  });
  try {
    await page.goto("/backoffice/affaires/all?sort=invalid");
    const affairs = page.locator("app-affairs");
    const exportButton = affairs.getByRole("button", {
      name: /Exporter les résultats affichés \(CSV\)|Export displayed results \(CSV\)/,
    });
    async function checkExport(name) {
      const columns = await affairs
        .locator("thead button[appTableSort] > span:first-child")
        .allTextContents();
      const rows = await affairs
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) =>
            Array.from(row.querySelectorAll("td:not(.actions-column)"), (cell) =>
              cell.textContent.trim(),
            ),
          ),
        );
      expect(columns).toHaveLength(6);
      const [download] = await Promise.all([page.waitForEvent("download"), exportButton.click()]);
      expect(download.suggestedFilename()).toBe("affairs.csv");
      const path = testInfo.outputPath(`${name}.csv`);
      await download.saveAs(path);
      const csv = await readFile(path, "utf8");
      expect(csv).toBe(serializeCsv(columns, rows));
      expect(csv).not.toContain(quoteId);
      expect(csv).not.toContain(clientId);
    }
    await expect(affairs.locator(".state")).toContainText(/Chargement|Loading/);
    await expect(page.locator("html")).toHaveAttribute("lang", /^(fr|en)$/);
    const countLabels =
      (await page.locator("html").getAttribute("lang")) === "fr"
        ? ["0 affaire", "1 affaire", "2 affaires"]
        : ["0 engagements", "1 engagement", "2 engagements"];
    const resultCount = affairs.locator('[listSummary][role="status"]');
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await expect(affairs.locator("[appListWorkspace]")).toHaveCSS("gap", "16px");
    await capture("commercial-affairs-loading");
    listGate.resolve();
    await expect(affairs.getByRole("alert")).toBeVisible();
    await capture("commercial-affairs-error");
    listState = "empty";
    await affairs.getByRole("button", { name: /Réessayer|Retry/ }).click();
    await expect(affairs.locator(".empty")).toBeVisible();
    await expect(resultCount).toHaveText(countLabels[0]);
    await expect(affairs.getByRole("alert")).toHaveCount(0);
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await exportButton.focus();
    const emptyHint = page.locator(`[id="${await exportButton.getAttribute("aria-describedby")}"]`);
    await expect(emptyHint).toBeVisible();
    await expect(emptyHint).toContainText(/Aucun résultat|no displayed results/);
    await page.keyboard.press("Escape");
    await expect(emptyHint).toBeHidden();
    await capture("commercial-affairs-empty");
    listState = "ready";
    await page.reload();
    await expect(affairs.locator("tbody tr")).toHaveCount(2);
    await expect(resultCount).toHaveText(countLabels[2]);
    await expect(affairs.locator("#affairs-column-updated")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await expect(affairs.locator("tbody td.reference a")).toHaveText([
      quote.reference,
      "DE-2026-000002",
    ]);
    await expect(affairs.locator("tbody td.reference a").first()).toHaveAttribute(
      "href",
      /sort=updated-desc/,
    );
    await expect(affairs.locator("button[appTableSort]")).toHaveCount(6);
    await expect(affairs.locator("thead .actions-column button")).toHaveCount(0);
    await capture("commercial-affairs-list");
    await capture("commercial-affairs-list-other-theme", {
      colorScheme: theme === "dark" ? "light" : "dark",
    });
    await setTheme(theme);
    const referenceSort = affairs.locator("#affairs-column-reference button[appTableSort]");
    await referenceSort.focus();
    await referenceSort.press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("sort") === "reference-asc");
    await expect(referenceSort).toBeFocused();
    await expect(affairs.locator("tbody td.reference a")).toHaveText([
      quote.reference,
      "DE-2026-000002",
    ]);
    await referenceSort.press("Enter");
    await expect(page).toHaveURL((url) => url.searchParams.get("sort") === "reference-desc");
    await expect(affairs.locator("tbody td.reference a")).toHaveText([
      "DE-2026-000002",
      quote.reference,
    ]);
    await page.goBack();
    await expect(affairs.locator("#affairs-column-reference")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(affairs.locator("tbody td.reference a")).toHaveText([
      quote.reference,
      "DE-2026-000002",
    ]);
    await page.goForward();
    await expect(affairs.locator("#affairs-column-reference")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    for (const [column, first, last] of [
      ["title", quote.reference, "DE-2026-000002"],
      ["client", quote.reference, "DE-2026-000002"],
      ["stage", quote.reference, "DE-2026-000002"],
      ["updated", "DE-2026-000002", quote.reference],
      ["amount", "DE-2026-000002", quote.reference],
    ]) {
      const header = affairs.locator(`#affairs-column-${column}`);
      await header.locator("button[appTableSort]").click();
      await expect(header).toHaveAttribute("aria-sort", "ascending");
      await expect(page).toHaveURL((url) => url.searchParams.get("sort") === `${column}-asc`);
      await expect(affairs.locator("tbody td.reference a")).toHaveText([first, last]);
      await header.locator("button[appTableSort]").click();
      await expect(header).toHaveAttribute("aria-sort", "descending");
      await expect(affairs.locator("tbody td.reference a")).toHaveText([last, first]);
      await expect(affairs.locator("thead [aria-sort]")).toHaveCount(1);
    }
    await capture("commercial-affairs-sorted");
    await expect(exportButton).toHaveAttribute("aria-disabled", "false");
    await exportButton.hover();
    const exportHint = page.locator(
      `[id="${await exportButton.getAttribute("aria-describedby")}"]`,
    );
    await expect(exportHint).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(exportHint).toBeHidden();
    await checkExport("commercial-affairs-sorted");
    await page.locator("#affairs-active-tab").click();
    await expect(affairs.locator("tbody tr")).toHaveCount(1);
    await page.locator("#affairs-completed-tab").click();
    await expect(affairs.locator("tbody tr")).toContainText("Boreal");
    await page.locator("#affairs-all-tab").click();
    const search = affairs.getByRole("searchbox", {
      name: /Rechercher une référence|Search by reference/,
    });
    await search.fill("zzzzzzzzzz");
    await expect(affairs.locator(".empty")).toBeVisible();
    await capture("commercial-affairs-no-matches", { audit: false });
    await affairs.getByRole("button", { name: /Effacer les filtres|Clear filters/ }).click();
    await expect(search).toBeFocused();
    await expect(page).toHaveURL((url) => url.searchParams.get("sort") === context.sort);
    await expect(affairs.locator("tbody tr")).toHaveCount(2);
    await search.fill("Audt");
    await expect(affairs.locator("tbody tr")).toHaveCount(1);
    await checkExport("commercial-affairs-fuzzy-search");
    await search.fill(context.q);
    const filtersTrigger = affairs.getByRole("button", { name: /^Filtres|^Filters/ });
    const filtersDialog = page.getByRole("dialog");
    const stageCategory = filtersDialog.getByRole("menuitem", { name: /^Progression|^Progress/ });
    const clientCategory = filtersDialog.getByRole("menuitem", { name: /^Client/ });
    const filterChoices = filtersDialog.getByRole("combobox", {
      name: /Rechercher une option|Search options/,
    });
    const backFilters = filtersDialog.getByRole("button", {
      name: /Revenir aux catégories de filtres|Back to filter categories/,
    });
    const draftOption = filtersDialog.getByRole("option", {
      name: /Devis à préparer|Quote to prepare/,
    });
    const clientOption = filtersDialog.getByRole("option", {
      name: client.displayName,
      exact: true,
    });
    await filtersTrigger.click();
    await expect(filtersDialog).toHaveAccessibleName(/^Filtres$|^Filters$/);
    await expect(filtersDialog.getByRole("menuitem")).toHaveCount(2);
    await expect(filtersDialog.locator("input, select")).toHaveCount(0);
    await expect(stageCategory).toBeFocused();
    await capture("commercial-affairs-filters");
    await stageCategory.press("Enter");
    await expect(filtersDialog).toHaveAccessibleName(/Progression|Progress/);
    await expect(filterChoices).toBeFocused();
    const unselectedUrl = page.url();
    await filterChoices.fill("zzzzzzzzzz");
    await expect(filtersDialog.getByRole("option")).toHaveCount(0);
    await expect(filtersDialog.getByRole("status")).toHaveText(
      /Aucune option ne correspond|No matching options/,
    );
    await expect(page).toHaveURL(unselectedUrl);
    await page.keyboard.press("Escape");
    await expect(filtersDialog).toHaveCount(0);
    await expect(filtersTrigger).toBeFocused();
    await expect(page).toHaveURL(unselectedUrl);
    await filtersTrigger.click();
    await stageCategory.click();
    await filterChoices.fill((await draftOption.innerText()).trim());
    await capture("commercial-affairs-stage-filter");
    await draftOption.click();
    await expect(filtersDialog).toHaveCount(0);
    await expect(filtersTrigger).toBeFocused();
    await expect(page).toHaveURL((url) => url.searchParams.get("stage") === context.stage);
    await filtersTrigger.click();
    await clientCategory.click();
    await expect(filtersDialog).toHaveAccessibleName("Client");
    await expect(filterChoices).toBeFocused();
    await filterChoices.fill(client.displayName);
    await expect(filtersDialog.getByRole("option")).toHaveCount(1);
    await capture("commercial-affairs-client-filter");
    await filterChoices.press("Home");
    await filterChoices.press("Enter");
    await expect(filtersDialog).toHaveCount(0);
    await expect(filtersTrigger).toBeFocused();
    await expect(filtersTrigger).toHaveAccessibleName(/\(2\)$/);
    await expectContext("/backoffice/affaires/all");
    await expect(affairs.locator("[appFilterChip]")).toHaveCount(3);
    await expect(affairs.locator("tbody tr")).toHaveCount(1);
    await expect(resultCount).toHaveText(countLabels[1]);
    await expect(affairs.locator("td.amount")).toHaveCSS("text-align", "end");
    await capture("commercial-affairs-filtered", { audit: false });
    await checkExport("commercial-affairs-filtered");
    await affairs.locator("tbody tr td:first-child a").click();
    await expectContext(`/backoffice/affaires/${quoteId}/overview`);
    const affair = page.locator("app-affair-detail");
    await expect(affair.locator("h1")).toHaveText(currentRevision.title);
    await capture("commercial-affair-overview");
    await page.locator("#affair-documents-tab").click();
    await expect(affair.locator("tbody tr")).toHaveCount(1);
    await capture("commercial-affair-documents", { audit: false });
    await page.locator("#affair-history-tab").click();
    await expect(affair.locator("tbody tr").first()).toBeVisible();
    await capture("commercial-affair-history", { audit: false });
    await page.locator("#affair-overview-tab").click();
    await affair.locator(".next-action a").click();
    await expectContext(`/backoffice/quotes/${quoteId}/summary`);
    const detail = page.locator("app-quote-detail");
    await expect(detail.locator("app-quote-lines tbody tr")).toHaveCount(
      currentRevision.lines.length,
    );
    await capture("commercial-quote-summary");
    await page.locator("#quote-document-tab").click();
    await expect(detail.locator("iframe")).toHaveAttribute(
      "src",
      `/api/quotes/${quoteId}/revisions/${quote.version}/preview`,
    );
    await expect(
      page.frameLocator("app-quote-document iframe").getByRole("heading", { level: 1 }),
    ).toHaveText("Document de démonstration");
    await capture("commercial-quote-document");
    await page.locator("#quote-versions-tab").click();
    await expect(detail.locator("tbody tr")).toHaveCount(quote.revisions.length);
    await capture("commercial-quote-versions", { audit: false });
    await detail.locator("tbody tr").first().getByRole("link").click();
    await expect(detail.locator("iframe")).toHaveAttribute(
      "src",
      `/api/quotes/${quoteId}/revisions/${acceptedRevision.version}/preview`,
    );
    await expectContext(`/backoffice/quotes/${quoteId}/document`);
    await page.locator("#quote-summary-tab").click();

    await detail.getByRole("button", { name: /Autres actions|More actions/ }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await capture("commercial-quote-actions");
    await page.getByRole("menuitem", { name: /Abandonner le devis|Cancel quote/ }).click();
    const cancel = detail.locator(".cancel-quote");
    await cancel.click();
    await expect(detail.getByRole("combobox")).toBeFocused();
    await expect(detail.getByRole("combobox")).toHaveAttribute("aria-invalid", "true");
    await detail.getByRole("combobox").selectOption("scope-changed");
    await detail.locator("textarea").fill("Scope changed. Keep this unsubmitted note.");
    await page.locator("#quote-versions-tab").click();
    await expect(confirmation).toHaveCount(0);
    await expectUnloadProtection(true);
    await page.locator("#quote-summary-tab").click();
    await expect(detail.getByRole("combobox")).toHaveValue("scope-changed");
    await expect(detail.locator("textarea")).toHaveValue(
      "Scope changed. Keep this unsubmitted note.",
    );
    await cancel.click();
    await expect(confirmation).toBeVisible();
    await expect(cancel).toHaveJSProperty("disabled", false);
    await expect(cancel).toHaveAttribute("aria-disabled", "true");
    await capture("commercial-cancellation-confirmation");
    await rejectConfirmation(cancel);
    const edit = detail.locator(`a[href^="/backoffice/quotes/${quoteId}/edit"]`);
    await edit.click();
    await rejectConfirmation(edit);
    await edit.click();
    await acceptConfirmation();
    await expectContext(`/backoffice/quotes/${quoteId}/edit`);

    const editor = page.locator("app-quote-editor");
    const save = editor.locator('button[type="submit"]');
    await expect(editor.locator(".document-line")).toHaveCount(currentRevision.lines.length);
    await capture("commercial-quote-editor");
    const formBounds = await editor.locator("form").boundingBox();
    const totalsBounds = await editor.locator("[appOutcomePanel]").boundingBox();
    if (page.viewportSize().width >= 1024) {
      expect(Math.abs(formBounds.y - totalsBounds.y)).toBeLessThan(2);
      expect(totalsBounds.x).toBeGreaterThan(formBounds.x + formBounds.width);
    } else expect(totalsBounds.y).toBeGreaterThanOrEqual(formBounds.y + formBounds.height);
    await capture("commercial-quote-editor-other-theme", {
      colorScheme: theme === "dark" ? "light" : "dark",
    });
    await setTheme(theme);
    await editor.locator("#quote-name").fill("");
    await expect(save).toBeEnabled();
    await save.click();
    await expect(editor.locator("#quote-name")).toBeFocused();
    await expect(editor.locator("#quote-name")).toHaveAttribute("aria-invalid", "true");
    await capture("commercial-quote-invalid");
    await editor.locator("#quote-name").fill("Audit — edited locally");
    const quantity = editor.locator(".document-line input").nth(1);
    const savedQuantity = await quantity.inputValue();
    await quantity.fill("0");
    await save.click();
    await expect(quantity).toBeFocused();
    await quantity.fill(savedQuantity);
    expect(revisionRequests).toHaveLength(0);

    const catalogTrigger = editor.locator(".catalog-picker button");
    await catalogTrigger.focus();
    await catalogTrigger.press("Enter");
    const picker = page.getByRole("dialog");
    await expect(picker.getByRole("searchbox")).toBeFocused();
    await expect(picker.locator(".option")).toHaveCount(2);
    await picker.getByRole("searchbox").fill("inspection");
    await expect(picker.locator(".option")).toHaveCount(1);
    await capture("commercial-catalog-picker");
    await picker.locator(".option").focus();
    await picker.locator(".option").press("Enter");
    await expect(catalogTrigger).toBeFocused();
    await expect(editor.locator(".document-line")).toHaveCount(currentRevision.lines.length + 1);
    const addedLine = editor.locator(".document-line").last();
    for (const [index, value] of [catalogItem.description, "1.500", "80.00", "20.00"].entries()) {
      await expect(addedLine.locator("input").nth(index)).toHaveValue(value);
    }
    const presetTrigger = editor.locator(".conditions-section app-object-picker button");
    await presetTrigger.click();
    await picker.getByRole("searchbox").fill("forfait inspection");
    await expect(picker.locator(".option")).toHaveCount(1);
    await expect(picker.locator(".option span")).toHaveText(`${preset.conditions.slice(0, 159)}…`);
    await capture("commercial-conditions-picker");
    await picker.locator(".option").click();
    await rejectConfirmation(presetTrigger);
    await expect(editor.locator("textarea")).toHaveValue(currentRevision.conditions);
    await presetTrigger.click();
    await picker.getByRole("searchbox").fill("forfait inspection");
    await picker.locator(".option").click();
    await acceptConfirmation();
    await expect(editor.locator("textarea")).toHaveValue(preset.conditions);
    await expectUnloadProtection(true);
    const editorBack = editor.locator(".back-link");
    await editorBack.click();
    await capture("commercial-editor-leave-confirmation", { audit: false });
    await rejectConfirmation(editorBack);
    await expect(editor.locator("#quote-name")).toHaveValue("Audit — edited locally");
    await save.click();
    await expect(save).toBeDisabled();
    await expect(editor.locator("#quote-name")).toBeDisabled();
    await editorBack.click();
    await expectContext(`/backoffice/quotes/${quoteId}/edit`);
    await expect(confirmation).toHaveCount(0);
    await capture("commercial-editor-pending", { audit: false });
    revisionGate.resolve();
    await expect(editor.getByRole("alert")).toContainText(/ailleurs|elsewhere/);
    expect(revisionRequests).toHaveLength(1);
    expect(revisionRequests[0]).toMatchObject({
      expectedVersion: quote.version,
      conditions: preset.conditions,
      title: "Audit — edited locally",
    });
    expect(revisionRequests[0].lines.at(-1)).toEqual({
      description: catalogItem.description,
      quantityMilli: 1500,
      unitPriceCents: 8000,
      vatRateBasisPoints: 2000,
    });
    await expect(editor.locator("#quote-name")).toHaveValue("Audit — edited locally");
    await capture("commercial-editor-conflict");
    await editorBack.click();
    await acceptConfirmation();
    await expectContext(`/backoffice/quotes/${quoteId}/summary`);

    await detail.locator(`a[href^="/backoffice/quotes/${quoteId}/publication"]`).click();
    await expectContext(`/backoffice/quotes/${quoteId}/publication`);
    const publication = page.locator("app-quote-publication");
    const publish = publication.locator(".publish-quote");
    const prepare = publication.locator("app-quote-document button");
    const review = publication.getByRole("checkbox");
    await expect(publication.locator(".facts")).toContainText(quote.reference);
    await expect(publication).toContainText(/aucun courriel|does not send an email/);
    await capture("commercial-publication-review");
    await publish.click();
    await expect(prepare).toBeFocused();
    expect(publicationRequests).toHaveLength(0);
    await prepare.click();
    await expect(publication.locator('app-quote-document [role="status"]')).toBeVisible();
    await publish.click();
    await expect(review).toBeFocused();
    await expect(review).toHaveAttribute("aria-invalid", "true");
    expect(publicationRequests).toHaveLength(0);
    const publicationBack = publication.locator(".back-link");
    await publicationBack.click();
    await rejectConfirmation(publicationBack);
    await review.check();
    await publish.click();
    await expect(publication.locator("app-document-issues li")).toHaveCount(1);
    await expect(
      publication.locator(`app-document-issues a[href="/backoffice/clients/${clientId}/profile"]`),
    ).toBeVisible();
    await capture("commercial-publication-blocked");
    await publish.click();
    await expect(publish).toBeDisabled();
    await publicationBack.click();
    await expectContext(`/backoffice/quotes/${quoteId}/publication`);
    await expect(confirmation).toHaveCount(0);
    await expectUnloadProtection(true);
    publicationGate.resolve();
    await expect(publication.getByRole("alert")).toContainText(/incertain|uncertain/i);
    await expect(publish).toBeDisabled();
    await expect(review).toBeDisabled();
    await capture("commercial-publication-uncertain");
    await publicationBack.click();
    await expect(confirmation).toContainText(/incertain|uncertain/i);
    await rejectConfirmation(publicationBack);
    detailUnavailable = true;
    await publication.locator('form button[type="button"]').click();
    await expect(publication.getByRole("alert")).toBeVisible();
    await expect(publication.locator("form")).toHaveCount(0);
    await expectUnloadProtection(true);
    await capture("commercial-publication-reload-error", { audit: false });
    detailUnavailable = false;
    await publication.getByRole("button", { name: /Réessayer|Retry/ }).click();
    await expect(publication).toContainText(
      /Ce devis ne peut pas être publié|This quote cannot be published/,
    );
    await expect(publication).toContainText(/lien.*récup|link.*retriev/i);
    await expect(publication.locator("form")).toHaveCount(0);
    await expect(publication.locator("app-copy-field")).toHaveCount(0);
    await expectUnloadProtection(false);
    await capture("commercial-publication-sent-without-link", { audit: false });
    expect(publicationRequests).toEqual([
      { expectedVersion: quote.version },
      { expectedVersion: quote.version },
    ]);
    await publicationBack.click();
    await expectContext(`/backoffice/quotes/${quoteId}/summary`);

    // The order must use its stored revision, not the newer current revision.
    quote = { ...quote, status: "accepted" };
    orderVisible = true;
    await page.reload();
    await detail.locator(`a[href^="/backoffice/orders/${order.id}"]`).click();
    await expectContext(`/backoffice/orders/${order.id}`);
    const orderPage = page.locator("app-order-detail");
    await expect(orderPage.locator("app-quote-lines tbody tr")).toHaveCount(
      acceptedRevision.lines.length,
    );
    await expect(orderPage.locator("app-quote-lines")).toContainText(
      acceptedRevision.lines[0].description,
    );
    await expect(orderPage.locator("app-quote-lines")).not.toContainText(
      currentRevision.lines[0].description,
    );
    await expect(orderPage.locator("form, input, textarea, select")).toHaveCount(0);
    await expect(orderPage.locator('a[href^="/backoffice/invoices/new"]')).toHaveAttribute(
      "href",
      `/backoffice/invoices/new?orderId=${order.id}`,
    );
    await capture("commercial-order-read");
    await orderPage.locator("button").click();
    await expect(orderPage.locator(`a[href="/api/orders/${order.id}/pdf"]`)).toBeVisible();
    missingAcceptedRevision = true;
    await page.reload();
    await expect(orderPage.getByRole("alert")).toBeVisible();
    await expect(orderPage.locator("app-quote-lines")).toHaveCount(0);
    await capture("commercial-order-revision-error", { audit: false });
    missingAcceptedRevision = false;
    await orderPage.getByRole("button", { name: /Réessayer|Retry/ }).click();
    await orderPage.locator(`a[href^="/backoffice/quotes/${quoteId}/document"]`).click();
    await expectContext(`/backoffice/quotes/${quoteId}/document`);
    expect(new URL(page.url()).searchParams.get("version")).toBe(String(acceptedRevision.version));
    await detail.locator(".back-link").click();
    await expectContext("/backoffice/affaires/all");
    await expect(search).toHaveValue(context.q);
    await filtersTrigger.click();
    await stageCategory.click();
    await expect(draftOption).toHaveAttribute("aria-selected", "true");
    await backFilters.click();
    await expect(stageCategory).toBeFocused();
    await clientCategory.click();
    await expect(clientOption).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(filtersDialog).toHaveCount(0);
    await expect(filtersTrigger).toBeFocused();
    await expect(page).toHaveURL((url) => url.searchParams.get("sort") === context.sort);

    await page.goto(`/backoffice/quotes/new?clientId=${clientId}`);
    await expect(editor.locator("#quote-client")).toHaveValue(clientId);
    await expectUnloadProtection(false);
    await save.click();
    await expect(editor.locator("#quote-name")).toBeFocused();
    await capture("commercial-quote-new-invalid");
    await editorBack.click();
    await expect(search).toBeVisible();
    await expect(confirmation).toHaveCount(0);
    expect(pdfRequests).toEqual([
      `/api/quotes/${quoteId}/revisions/${quote.version}/pdf`,
      `/api/orders/${order.id}/pdf`,
    ]);
    expect(unexpectedWrites).toEqual([]);
  } finally {
    listGate.resolve();
    revisionGate.resolve();
    publicationGate.resolve();
    await page.unroute(apiPattern, handler);
    await Promise.allSettled(activeRoutes);
    if (!page.isClosed()) await setTheme(originalTheme);
  }
}
