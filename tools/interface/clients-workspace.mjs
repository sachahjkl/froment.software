import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { client, clientId, invoiceId, invoiceSummary, quoteId } from "./fixtures.mjs";
import { openBackOfficeNavigation } from "./dashboard-shell.mjs";

async function capture(page, testInfo, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function readCsv(page, button, filename) {
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe(filename);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(await download.failure()).toBeNull();
  return Buffer.concat(chunks).toString("utf8");
}

async function openFilterPanel(page, button, category) {
  await button.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("menuitem")).toHaveCount(2);
  await expect(dialog.getByRole("menuitem").first()).toBeFocused();
  await expect(dialog.locator("input, select")).toHaveCount(0);
  await dialog.getByRole("menuitem", { name: category }).click();
  await expect(
    dialog.getByRole("combobox", { name: /Rechercher une option|Search options/ }),
  ).toBeFocused();
  return dialog;
}

async function checkDashboardAndSearch(page, testInfo) {
  const quote = {
    id: quoteId,
    reference: "DE-2026-000001",
    clientId,
    clientDisplayName: client.displayName,
    status: "draft",
    version: 1,
    title: "Audit du système industriel",
    currency: "EUR",
    totalCents: 360000,
    updatedAt: invoiceSummary.updatedAt,
  };
  const order = {
    id: invoiceSummary.orderId,
    reference: invoiceSummary.orderReference,
    quoteId,
    quoteReference: quote.reference,
    revisionId: "01ARZ3NDEKTSV4RRFFQ69G5FAZ",
    clientId,
    clientDisplayName: client.displayName,
    title: "Commande à facturer",
    currency: "EUR",
    totalCents: 360000,
    createdAt: invoiceSummary.updatedAt,
    invoiceId: null,
  };
  const failedInvoice = {
    ...invoiceSummary,
    title: "Facture avec PDF en échec",
    status: "issued",
    invoiceNumber: "FA-2026-000001",
    dueDate: "2020-01-01",
    recordedPaidCents: 10000,
    pdf: { status: "failed", attempts: 1, error: "pdf.render_failed" },
  };
  const creditedInvoice = {
    ...failedInvoice,
    id: "01ARZ3NDEKTSV4RRFFQ69G5FC1",
    invoiceNumber: "FA-2026-000002",
    title: "Facture avec avoir partiel",
    creditedCents: 10000,
    pdf: null,
  };
  const reminderInvoice = {
    ...failedInvoice,
    id: "01ARZ3NDEKTSV4RRFFQ69G5FC2",
    invoiceNumber: "FA-2026-000003",
    title: "Facture à relancer",
    pdf: null,
  };
  const responses = new Map([
    ["clients", [client]],
    [
      "quotes",
      [
        quote,
        {
          ...quote,
          id: "01ARZ3NDEKTSV4RRFFQ69G5FC3",
          reference: "DE-2026-000002",
          status: "sent",
          title: "Devis en attente",
        },
      ],
    ],
    ["orders", [order]],
    ["invoices", [failedInvoice, creditedInvoice, reminderInvoice]],
  ]);
  let state = "loading";
  let release;
  let pending = new Promise((resolve) => {
    release = resolve;
  });
  const pattern = /\/api\/(clients|quotes|orders|invoices)$/;
  const handler = async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const kind = new URL(route.request().url()).pathname.split("/").at(-1);
    if (state === "loading") await pending;
    if (state === "error") return route.fulfill({ status: 503, json: {} });
    return route.fulfill({ json: state === "empty" ? [] : responses.get(kind) });
  };
  await page.route(pattern, handler);
  try {
    await page.goto("/backoffice/dashboard");
    await expect(page.locator('app-dashboard [role="status"]')).toBeVisible();
    await capture(page, testInfo, "dashboard-loading");
    state = "error";
    release();
    await expect(page.locator('app-dashboard [role="alert"]')).toBeVisible();
    await capture(page, testInfo, "dashboard-error");
    state = "ready";
    const loadedAfter = await page.evaluate(() => Date.now());
    await page
      .locator("app-dashboard")
      .getByRole("button", { name: /Retry|Réessayer/ })
      .click();
    const metrics = page.locator("app-dashboard .metrics a");
    await expect(metrics).toHaveCount(5);
    const links = [
      "/backoffice/affaires/attention?stage=draft",
      "/backoffice/affaires/active?stage=sent",
      "/backoffice/affaires/attention?stage=ordered",
      "/backoffice/facturation?status=issued",
      "/backoffice/facturation?status=issued&due=overdue",
    ];
    for (const [index, href] of links.entries()) {
      await expect(metrics.nth(index)).toHaveAttribute("href", href);
      await expect(metrics.nth(index)).toHaveAttribute("aria-describedby", "dashboard-loaded-at");
    }
    for (const index of [0, 1, 2])
      await expect(metrics.nth(index).locator("strong")).toHaveText("1");
    await expect(metrics.nth(3).locator("strong")).toHaveText(/10.?400[,.]00/);
    await expect(metrics.nth(4).locator("strong")).toHaveText("3");
    const measuredAt = Date.parse(
      await page.locator("#dashboard-loaded-at time").getAttribute("datetime"),
    );
    expect(measuredAt).toBeGreaterThanOrEqual(loadedAfter);
    expect(measuredAt).toBeLessThanOrEqual(await page.evaluate(() => Date.now()));
    const rows = page.locator("app-dashboard tbody tr");
    await expect(rows.first()).toContainText(failedInvoice.title);
    await expect(rows.first().locator("a")).toHaveAttribute(
      "href",
      `/backoffice/invoices/${invoiceId}`,
    );
    await expect(rows.filter({ hasText: creditedInvoice.title }).locator("a")).toHaveAttribute(
      "href",
      `/backoffice/invoices/${creditedInvoice.id}`,
    );
    await expect(rows.filter({ hasText: reminderInvoice.title }).locator("a")).toHaveAttribute(
      "href",
      `/backoffice/courriels/new?invoice=${reminderInvoice.id}`,
    );
    await expect(rows.filter({ hasText: order.title }).locator("a")).toHaveAttribute(
      "href",
      `/backoffice/invoices/new?orderId=${order.id}`,
    );
    await expect(rows.filter({ hasText: "Devis en attente" })).toContainText(
      /Attente normale|Normal waiting/,
    );
    await expect(page.locator(".activity-list time")).toHaveCount(6);
    for (const timestamp of await page.locator(".activity-list time").all()) {
      await expect(timestamp).toHaveAttribute("datetime", invoiceSummary.updatedAt);
      await expect(timestamp).not.toBeEmpty();
    }
    await capture(page, testInfo, "dashboard-metrics");

    state = "loading";
    pending = new Promise((resolve) => {
      release = resolve;
    });
    const search = page.locator(".workspace-header app-global-search");
    const input = search.locator("#global-search");
    await input.fill("developement");
    await expect(search.getByRole("status")).toContainText(/Loading|Chargement/);
    await capture(page, testInfo, "global-search-loading");
    state = "error";
    release();
    await expect(search.getByRole("alert")).toBeVisible();
    await capture(page, testInfo, "global-search-error");
    for (const [kind, items] of responses) {
      responses.set(
        kind,
        Array.from({ length: 7 }, (_, index) => ({
          ...items[0],
          id: index === 0 ? items[0].id : `${items[0].id.slice(0, -2)}D${index}`,
        })),
      );
    }
    state = "ready";
    await search.getByRole("button", { name: /Retry|Réessayer/ }).click();
    for (const kind of ["client", "quote", "order", "invoice"]) {
      await expect(
        search.locator(`section[aria-labelledby="global-search-${kind}"] li`),
      ).toHaveCount(5);
    }
    await expect(search.locator('.result-heading [role="status"]')).toHaveText(
      /^(20 résultats affichés · Maximum : 5 par catégorie\.|20 displayed results · Maximum: 5 per category\.)$/,
    );
    await expect(search.locator(".result-heading")).toContainText(/Maximum\s*: 5/);
    await capture(page, testInfo, "global-search-results");
    await input.fill("zzzzzzzz");
    await expect(search.locator(".results li")).toHaveCount(0);
    await expect(search.locator('.result-heading [role="status"]')).toHaveText(
      /^(0 résultat affiché · Maximum : 5 par catégorie\.|0 displayed results · Maximum: 5 per category\.)$/,
    );
    await capture(page, testInfo, "global-search-empty");
    await input.fill("developement");
    await input.press("Escape");
    await expect(search.locator(".results")).toHaveCount(0);
    await expect(input).toBeFocused();
    await input.fill("développement");
    const result = search.locator(`a[href="/backoffice/clients/${clientId}"]`);
    await result.focus();
    await result.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/profile$`));
    await expect(search.locator(".results")).toHaveCount(0);

    state = "empty";
    await page.goto("/backoffice/dashboard");
    await expect(page.locator("app-dashboard .action-section .empty")).toBeVisible();
    await expect(metrics).toHaveCount(5);
    for (const index of [0, 1, 2, 4])
      await expect(metrics.nth(index).locator("strong")).toHaveText("0");
    await expect(metrics.nth(3).locator("strong")).toHaveText(/0[,.]00/);
    await capture(page, testInfo, "dashboard-empty");
  } finally {
    state = "empty";
    release();
    await page.unroute(pattern, handler);
  }
}

export async function checkClientsWorkspace(page, testInfo) {
  await checkDashboardAndSearch(page, testInfo);
  const createdId = "01ARZ3NDEKTSV4RRFFQ69G5FB0";
  let records = [client];
  let releaseList;
  let failList = true;
  let conflict = true;
  let creationCount = 0;
  let updatedRequest;
  let logoutRequests = 0;
  let accesses = [];
  const accessRequests = [];
  let accessUnavailable = true;
  let releaseAccess;
  const accessPending = new Promise((resolve) => {
    releaseAccess = resolve;
  });
  let revocations = 0;
  const listPattern = "**/api/clients";
  const detailPattern = /\/api\/clients\/[A-Z0-9]+$/;
  const actionPattern = /\/api\/clients\/[A-Z0-9]+\/(archive|reactivate|access)$/;
  const logoutPattern = "**/api/auth/logout";
  const revokePattern = /\/api\/clients\/[A-Z0-9]+\/access\/[A-Z0-9]+$/;
  const revokeHandler = async (route) => {
    expect(route.request().method()).toBe("DELETE");
    revocations++;
    accesses = [];
    return route.fulfill({ json: null });
  };
  const logoutHandler = (route) => {
    logoutRequests++;
    return logoutRequests === 1
      ? route.fulfill({ status: 503, json: { code: "authentication.error" } })
      : route.fulfill({ status: 204 });
  };
  const listHandler = async (route) => {
    if (route.request().method() === "POST") {
      creationCount++;
      const created = {
        ...route.request().postDataJSON(),
        id: createdId,
        archived: false,
        updatedAt: 42,
      };
      records = [...records, created];
      return route.fulfill({ json: created });
    }
    if (failList) {
      await new Promise((resolve) => {
        releaseList = resolve;
      });
      return route.fulfill({ status: 503, json: { code: "client.error" } });
    }
    return route.fulfill({ json: records });
  };
  const detailHandler = async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-1);
    let record = records.find((item) => item.id === id);
    if (route.request().method() === "PUT") {
      updatedRequest = route.request().postDataJSON();
      if (conflict)
        return route.fulfill({
          status: 409,
          json: { _tag: "ClientVersionConflict", code: "client.version_conflict" },
        });
      const { expectedUpdatedAt, ...fields } = updatedRequest;
      expect(expectedUpdatedAt).toBe(record.updatedAt);
      record = { ...record, ...fields, updatedAt: record.updatedAt + 1 };
      records = records.map((item) => (item.id === id ? record : item));
    }
    return route.fulfill({ json: record });
  };
  const actionHandler = async (route) => {
    const parts = new URL(route.request().url()).pathname.split("/");
    const action = parts.at(-1);
    if (action === "access") {
      if (route.request().method() === "GET") return route.fulfill({ json: accesses });
      accessRequests.push(route.request().postDataJSON());
      if (accessUnavailable) {
        await accessPending;
        return route.fulfill({ status: 503, json: { code: "client.error" } });
      }
      const access = {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FB1",
        clientId: parts.at(-2),
        email: route.request().postDataJSON().email,
        createdAt: 1788600000000,
      };
      accesses = [...accesses, access];
      return route.fulfill({ json: access });
    }
    const id = parts.at(-2);
    records = records.map((record) =>
      record.id === id ? { ...record, archived: action === "archive" } : record,
    );
    return route.fulfill({ json: records.find((record) => record.id === id) });
  };
  await page.route(revokePattern, revokeHandler);
  await page.route(logoutPattern, logoutHandler);
  await page.route(listPattern, listHandler);
  await page.route(detailPattern, detailHandler);
  await page.route(actionPattern, actionHandler);
  try {
    await page.goto("/backoffice/clients");
    const list = page.locator("app-clients");
    const listSearch = list.getByRole("searchbox", { name: /Rechercher|Search/ });
    const filterButton = list.locator("app-filter-menu > button");
    const exportButton = list.locator("app-table-export button");
    const listCount = list.locator('app-list-toolbar [listSummary][role="status"]');
    await expect(page.locator('app-clients [role="status"]')).toContainText(/Loading|Chargement/);
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await expect(filterButton).toBeDisabled();
    await capture(page, testInfo, "clients-loading");
    releaseList();
    await expect(page.locator('app-clients [role="alert"]')).toBeVisible();
    await capture(page, testInfo, "clients-error");
    failList = false;
    await page
      .locator("app-clients")
      .getByRole("button", { name: /Retry|Réessayer/ })
      .click();
    await expect(page.locator("app-clients tbody tr")).toHaveCount(1);
    await expect(listCount).toHaveText("1 client");
    records = [
      client,
      {
        ...client,
        id: "01ARZ3NDEKTSV4RRFFQ69G5FD8",
        displayName: "Zèbre atelier",
        country: "Belgique",
        updatedAt: client.updatedAt - 86400000,
      },
    ];
    await page.reload();
    await expect(list.locator("tbody tr")).toHaveCount(2);
    await expect(listCount).toHaveText("2 clients");
    const sortButtons = list.locator("thead button[appTableSort]");
    await expect(sortButtons).toHaveCount(3);
    await expect(list.locator("thead [aria-sort]")).toHaveCount(1);
    await sortButtons.nth(0).press("Enter");
    await expect(list.locator("tbody th a")).toHaveText(["Zèbre atelier", client.displayName]);
    await expect(sortButtons.nth(0).locator("..")).toHaveAttribute("aria-sort", "descending");
    await expect(page).toHaveURL(/sort=name-desc/);
    await sortButtons.nth(1).click();
    await expect(page).toHaveURL(/sort=country-asc/);
    await expect(list.locator("tbody th a")).toHaveText(["Zèbre atelier", client.displayName]);
    await sortButtons.nth(2).click();
    await expect(page).toHaveURL(/sort=date-asc/);
    await expect(list.locator("tbody th a")).toHaveText(["Zèbre atelier", client.displayName]);
    await sortButtons.nth(2).click();
    await expect(list.locator("tbody th a")).toHaveText([client.displayName, "Zèbre atelier"]);
    await expect(list.locator("thead [aria-sort]")).toHaveCount(1);
    await exportButton.focus();
    await expect(list.locator("app-table-export [role=tooltip]:popover-open")).toBeVisible();
    const sortedCsv = await readCsv(page, exportButton, "clients.csv");
    const sortedLines = sortedCsv.trim().split("\r\n");
    expect(sortedLines).toHaveLength(3);
    expect(sortedLines[1]).toContain(client.displayName);
    expect(sortedLines[2]).toContain("Zèbre atelier");
    expect(sortedLines[0]).toMatch(/Dernière modification|Last modified/);
    await sortButtons.nth(0).click();
    records = [client];
    await page.reload();
    await expect(list.locator("tbody tr")).toHaveCount(1);
    await listSearch.fill("developement");
    await expect(page.locator("app-clients tbody tr")).toHaveCount(1);
    const filterDialog = await openFilterPanel(page, filterButton, /^(Pays|Country)/);
    const choiceSearch = filterDialog.getByRole("combobox", {
      name: /Rechercher une option|Search options/,
    });
    await choiceSearch.fill("zzzzzzzz");
    await expect(filterDialog.getByRole("option")).toHaveCount(0);
    await expect(filterDialog.getByRole("status")).toHaveText(
      /Aucune option ne correspond|No matching options/,
    );
    await choiceSearch.press("Enter");
    await expect(page).toHaveURL(/\/clients\/active\?q=developement$/);
    await filterDialog
      .getByRole("button", { name: /Revenir aux catégories|Back to filter categories/ })
      .click();
    await expect(filterDialog.getByRole("menuitem", { name: /^(Pays|Country)/ })).toBeFocused();
    await capture(page, testInfo, "clients-filter-menu");
    await filterDialog.getByRole("menuitem", { name: /^(Pays|Country)/ }).press("Enter");
    await expect(choiceSearch).toHaveValue("");
    await choiceSearch.fill("france");
    await expect(filterDialog.getByRole("option")).toHaveCount(1);
    await expect(page).toHaveURL(/\/clients\/active\?q=developement$/);
    await capture(page, testInfo, "clients-country-choices");
    await choiceSearch.press("End");
    await choiceSearch.press("Enter");
    await expect(filterDialog).toHaveCount(0);
    await expect(filterButton).toBeFocused();
    await expect(page).toHaveURL(/q=developement&country=France/);
    await openFilterPanel(page, filterButton, /^(Coordonnées|Contact details)/);
    await filterDialog
      .getByRole("option", { name: /^(Coordonnées incomplètes|Incomplete contact details)$/ })
      .click();
    await expect(filterDialog).toHaveCount(0);
    await expect(page.locator("app-clients app-empty-state")).toBeVisible();
    await expect(listCount).toHaveText(/^(0 client|0 clients)$/);
    await expect(page).toHaveURL(/contact=incomplete/);
    await openFilterPanel(page, filterButton, /^(Coordonnées|Contact details)/);
    await expect(
      filterDialog.getByRole("option", {
        name: /^(Coordonnées incomplètes|Incomplete contact details)$/,
      }),
    ).toHaveAttribute("aria-selected", "true");
    await filterDialog
      .getByRole("option", { name: /^(Toutes les coordonnées|All contact details)$/ })
      .click();
    await expect(page.locator("app-clients tbody tr")).toHaveCount(1);
    await expect(filterButton).toBeFocused();
    await page.locator("#clients-archived-tab").click();
    await expect(page).toHaveURL(/\/clients\/archived\?q=developement&country=France$/);
    await expect(page.locator("app-clients app-empty-state")).toBeVisible();
    await page.locator("#clients-active-tab").click();
    await expect(listSearch).toHaveValue("developement");
    await openFilterPanel(page, filterButton, /^(Pays|Country)/);
    await expect(filterDialog.getByRole("option", { name: "France", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("app-clients tbody tr")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(page.locator("app-clients tbody th")).toHaveCSS("text-transform", "none");
    const filteredCsv = await readCsv(page, exportButton, "clients.csv");
    expect(filteredCsv.trim().split("\r\n")).toHaveLength(2);
    expect(filteredCsv).toContain(client.email);
    expect(filteredCsv).not.toContain("Zèbre atelier");
    expect(filteredCsv).not.toMatch(/access\/|password|token|signature/i);
    await sortButtons.nth(2).click();
    await sortButtons.nth(2).click();
    await list.locator("tbody a").click();
    await expect(page).toHaveURL(new RegExp(`/clients/${clientId}/profile\\?`));
    await page.locator("#client-documents-tab").click();
    await page.locator("app-client-detail .client-page > a").click();
    await expect(page).toHaveURL(
      /\/clients\/active\?q=developement&country=France&sort=date-desc$/,
    );
    await expect(list.locator("thead th[aria-sort]")).toHaveAttribute("aria-sort", "descending");
    if (page.viewportSize().width >= 1024) {
      expect(
        await page
          .locator("app-clients [appDataTable]")
          .evaluate((node) => node.scrollWidth > node.clientWidth),
      ).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath("clients-list.png"), fullPage: true });
    const originalTheme = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme === "dark" ? "light" : "dark";
    }, originalTheme);
    await page.screenshot({
      path: testInfo.outputPath("clients-list-other-theme.png"),
      fullPage: true,
    });
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, originalTheme);
    await listSearch.fill("zzzzzzzz");
    await expect(page.locator("app-empty-state")).toBeVisible();
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await exportButton.focus();
    await expect(list.locator("app-table-export [role=tooltip]:popover-open")).toBeVisible();
    await capture(page, testInfo, "clients-empty");
    await page.locator("app-clients app-page-header a").click();
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(page.locator("app-client-editor")).toBeVisible();
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page.locator("#client-displayName")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#client-displayName")).toBeFocused();
    await page.locator("#client-displayName").fill("Client de démonstration");
    await page.locator("#client-email").fill("client@example.test");
    await page.locator("app-client-editor .actions a").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#client-displayName")).toHaveValue("Client de démonstration");
    await expect(page.locator("app-client-editor .actions a")).toBeFocused();
    const search = page.locator(".workspace-header app-global-search");
    const searchInput = search.locator("#global-search");
    await searchInput.fill("developement");
    const result = search.locator(`a[href="/backoffice/clients/${clientId}"]`);
    await result.focus();
    const originalLink = await result.elementHandle();
    await result.press("Enter");
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
    expect(await originalLink.evaluate((node) => node.isConnected)).toBe(true);
    await capture(page, testInfo, "client-search-exit-confirmation");
    await confirmation.locator("[data-confirmation-cancel]").click();
    await expect(confirmation).toHaveCount(0);
    await expect(page).toHaveURL(/\/clients\/new$/);
    await expect(result).toBeFocused();
    expect(await originalLink.evaluate((node) => node === document.activeElement)).toBe(true);
    await originalLink.dispose();
    await expect(page.locator("#client-displayName")).toHaveValue("Client de démonstration");
    await expect(page.locator("#client-email")).toHaveValue("client@example.test");
    await expect(searchInput).toHaveValue("developement");
    expect(creationCount).toBe(0);
    await searchInput.press("Escape");
    await expect(searchInput).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("client-create.png"), fullPage: true });
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/profile$`));
    expect(creationCount).toBe(1);
    await expect(page.locator("app-client-detail form")).toHaveCount(0);
    await expect(page.locator("app-client-detail .profile")).toContainText("client@example.test");
    await expect(
      page.locator(`app-client-detail a[href="/backoffice/quotes/new?clientId=${createdId}"]`),
    ).toBeVisible();
    await page.locator(`app-client-detail a[href="/backoffice/clients/${createdId}/edit"]`).click();
    await page.locator("#client-city").fill("Lyon");
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page.locator('app-client-editor [role="alert"]')).toContainText(
      /elsewhere|ailleurs/,
    );
    await expect(page.locator("#client-city")).toHaveValue("Lyon");
    expect(updatedRequest.expectedUpdatedAt).toBe(42);
    conflict = false;
    await page.locator('app-client-editor button[type="submit"]').click();
    await expect(page.locator("app-client-detail .profile")).toContainText("Lyon");
    await page.locator(".client-actions summary").click();
    await page.locator(".client-actions button").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Confirm|Confirmer)$/ })
      .click();
    await expect(page.locator(".archived-notice")).toBeVisible();
    await page.locator(".archived-notice button").click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/access$`));
    await expect(page.locator("app-client-detail form")).toHaveCount(0);
    await page
      .locator(`.access-panel a[href="/backoffice/clients/${createdId}/access/new"]`)
      .click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/access/new$`));
    const accessEditor = page.locator("app-client-access-editor");
    const email = accessEditor.locator("#client-account-email");
    const password = accessEditor.locator("#client-account-password");
    const submit = accessEditor.locator('[type="submit"]');
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("aria-invalid", "true");
    expect(accessRequests).toHaveLength(0);
    await email.fill("portal@example.test");
    await password.fill("Local browser fixture password only 1234!");
    const accessBack = accessEditor.locator(".access-editor > a");
    await accessBack.click();
    await expect(confirmation).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(accessBack).toBeFocused();
    await expect(email).toHaveValue("portal@example.test");
    await expect(password).toHaveValue("Local browser fixture password only 1234!");
    await Promise.all([
      page.waitForEvent("dialog").then(async (dialog) => {
        expect(dialog.type()).toBe("beforeunload");
        await dialog.dismiss();
      }),
      page.evaluate(() => window.location.reload()),
    ]);
    await expect(email).toHaveValue("portal@example.test");
    await expect(password).toHaveValue("Local browser fixture password only 1234!");
    await capture(page, testInfo, "client-access-create");
    await submit.click();
    await expect(email).toBeDisabled();
    await expect(password).toBeDisabled();
    await expect(submit).toBeDisabled();
    await accessBack.click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/access/new$`));
    await expect(confirmation).toHaveCount(0);
    await capture(page, testInfo, "client-access-pending");
    releaseAccess();
    await expect(accessEditor.getByRole("alert")).toBeVisible();
    await expect(email).toHaveValue("portal@example.test");
    await expect(password).toHaveValue("Local browser fixture password only 1234!");
    expect(accessRequests).toHaveLength(1);
    await capture(page, testInfo, "client-access-error");
    accessUnavailable = false;
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/clients/${createdId}/access$`));
    expect(accessRequests).toHaveLength(2);
    expect(accessRequests[1]).toEqual(accessRequests[0]);
    await expect(page.locator(".access-panel tbody tr")).toHaveCount(1);
    await expect(page.locator(".access-panel tbody")).toContainText("portal@example.test");
    await expect(page.locator("app-client-detail form")).toHaveCount(0);
    await page.locator(".access-panel tbody button").click();
    await confirmation.locator("[data-confirmation-cancel]").click();
    expect(revocations).toBe(0);
    await expect(page.locator(".access-panel tbody button")).toBeFocused();
    await page.locator(".access-panel tbody button").click();
    await confirmation.locator("button").last().click();
    await expect(page.locator(".access-panel tbody tr")).toHaveCount(0);
    expect(revocations).toBe(1);
    await capture(page, testInfo, "client-access-empty");
    await page.goto(`/backoffice/clients/${clientId}/profile`);
    await expect(page.locator("app-client-detail h1")).toHaveText(client.displayName);
    await page.evaluate(() => window.scrollTo(0, 0));
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("client-profile.png"), fullPage: true });
    await page.locator("#client-affairs-tab").click();
    await expect(
      page.locator(`#client-affairs-panel a[href="/backoffice/affaires/${quoteId}"]`),
    ).toBeVisible();
    await page.locator("#client-documents-tab").click();
    await expect(page.locator(`.documents a[href="/backoffice/quotes/${quoteId}"]`)).toBeVisible();
    await expect(
      page.locator(`.documents a[href="/backoffice/invoices/${invoiceId}"]`),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("client-documents.png"), fullPage: true });
    await page.goto("/design/list-workspace");
    await page.waitForLoadState("networkidle");
    await page.locator('[storyPreview] app-list-toolbar input[type="search"]').fill("Boréal");
    await expect(page.locator("[storyPreview] tbody tr")).toHaveCount(1);
    await expect(page.locator("[storyPreview] tbody th")).toHaveText("Boréal");
    await page.screenshot({ path: testInfo.outputPath("design-table.png"), fullPage: true });
    await page.goto("/design/empty-state");
    await expect(page.locator("[storyPreview] app-empty-state")).toBeVisible();
    await page.goto("/design/drawer");
    await page.waitForLoadState("networkidle");
    await page.locator("[storyPreview] > button[appButton]").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`/backoffice/clients/${clientId}/edit`);
    await page.locator("#client-city").fill("Saisie conservée");
    await openBackOfficeNavigation(page);
    await page.locator(".account summary:visible").click();
    await page.locator(".sign-out:visible").click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(logoutRequests).toBe(0);
    await expect(page.locator("#client-city")).toHaveValue("Saisie conservée");
    await page.locator(".sign-out:visible").click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /^(Confirm|Confirmer)$/ })
      .click();
    await expect(page.locator('app-sign-out [role="alert"]')).toBeVisible();
    expect(logoutRequests).toBe(1);
    await page.screenshot({ path: testInfo.outputPath("sign-out-error.png"), fullPage: true });
    await page.locator("app-sign-out button").click();
    await expect(page).toHaveURL(/\/backoffice\/login$/);
    expect(logoutRequests).toBe(2);
  } finally {
    releaseList?.();
    releaseAccess();
    await page.unroute(listPattern, listHandler);
    await page.unroute(detailPattern, detailHandler);
    await page.unroute(actionPattern, actionHandler);
    await page.unroute(logoutPattern, logoutHandler);
    await page.unroute(revokePattern, revokeHandler);
  }
}
