import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  accountEmail,
  clientId,
  invoiceId,
  invoiceSummary,
  quoteId,
  quoteToken,
} from "./fixtures.mjs";

async function capture(page, testInfo, name) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

async function expectFilters(page, filters) {
  await expect.poll(() => Object.fromEntries(new URL(page.url()).searchParams)).toEqual(filters);
}

async function readCsv(page, button) {
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe("documents.csv");
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

async function checkPortal(page, testInfo) {
  let authenticated = false;
  let state = "loading";
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  let invoiceOverride;
  const listRequests = [];
  const administratorRequests = [];
  const authPattern = /\/api\/auth\/(refresh|account)$/;
  const listPattern = /\/api\/client\/(quotes|orders|invoices)$/;
  const administratorPattern = /\/api\/(clients|quotes|orders|invoices)(\/[^?]*)?$/;
  const authHandler = (route) => {
    if (!authenticated)
      return route.fulfill({ status: 401, json: { code: "authentication.required" } });
    return route.fulfill({
      json: route.request().url().endsWith("/account")
        ? { userId: clientId, email: accountEmail, mode: "client" }
        : { expiresAt: Date.now() + 600000, mode: "client" },
    });
  };
  const listHandler = async (route) => {
    expect(route.request().method()).toBe("GET");
    listRequests.push(new URL(route.request().url()).pathname);
    if (state === "loading") await pending;
    if (state === "error") return route.fulfill({ status: 503, json: {} });
    if (state === "empty") return route.fulfill({ json: [] });
    if (invoiceOverride && route.request().url().endsWith("/invoices"))
      return route.fulfill({ json: [invoiceOverride] });
    return route.fallback();
  };
  const administratorHandler = (route) => {
    administratorRequests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ status: 403, json: {} });
  };
  await page.route(authPattern, authHandler);
  await page.route(listPattern, listHandler);
  await page.route(administratorPattern, administratorHandler);
  const detailPath = `/backoffice/client/documents/invoice/${invoiceId}`;
  const filters = { q: "Audit", kind: "invoice", status: "open", sort: "amount-desc" };
  const query = new URLSearchParams(filters).toString();
  try {
    await page.goto(`${detailPath}?${query}`);
    await expect(page).toHaveURL(/\/backoffice\/login\?/);
    await expectFilters(page, { returnUrl: `${detailPath}?${query}` });
    expect(listRequests).toHaveLength(0);
    authenticated = true;
    await page.goto("/backoffice/dashboard");
    await expect(page).toHaveURL(/\/backoffice\/login$/);
    expect(administratorRequests).toHaveLength(0);

    await page.goto("/backoffice/client");
    const portal = page.locator("app-client-portal");
    const search = portal.getByRole("searchbox", {
      name: /Rechercher un document|Search documents/,
    });
    const filterButton = portal.locator("app-filter-menu > button");
    const exportButton = portal.locator("app-table-export button");
    const documentCount = portal.locator('app-list-toolbar [listSummary][role="status"]');
    await expect(portal.locator('.state[role="status"]')).toBeVisible();
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await expect(filterButton).toBeDisabled();
    await expect(page.locator("app-global-search")).toHaveCount(0);
    await capture(page, testInfo, "customer-portal-loading");
    state = "error";
    release();
    await expect(portal.getByRole("alert")).toBeVisible();
    await capture(page, testInfo, "customer-portal-error");
    state = "empty";
    await portal.getByRole("button", { name: /Réessayer|Try again/ }).click();
    await expect(portal.locator("app-empty-state")).toBeVisible();
    await expect(portal.locator("tbody tr")).toHaveCount(0);
    await expect(documentCount).toHaveText(/^(0 document|0 documents)$/);
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await exportButton.focus();
    await expect(portal.locator("app-table-export [role=tooltip]:popover-open")).toBeVisible();
    await capture(page, testInfo, "customer-portal-empty");
    state = "ready";
    invoiceOverride = {
      ...invoiceSummary,
      status: "issued",
      invoiceNumber: "FA-2026-000001",
      totalCents: 900,
      recordedPaidCents: 0,
      creditedCents: 0,
      remainingCents: 900,
      pdfAvailable: true,
    };
    await page.reload();
    await expect(portal.locator("tbody tr")).toHaveCount(3);
    await expect(documentCount).toHaveText("3 documents");
    await expect(portal.locator("form, a[download], iframe")).toHaveCount(0);
    const sorts = portal.locator("thead button[appTableSort]");
    await expect(sorts).toHaveCount(5);
    await expect(sorts.nth(3).locator("..")).toHaveAttribute("aria-sort", "descending");
    await sorts.nth(4).press("Enter");
    await expectFilters(page, { sort: "amount-asc" });
    await expect(portal.locator("tbody th a")).toHaveText([
      "FA-2026-000001",
      "CO-2026-000001",
      "DE-2026-000001",
    ]);
    await sorts.nth(4).press("Space");
    await expectFilters(page, { sort: "amount-desc" });
    await expect(portal.locator("tbody th a")).toHaveText([
      "CO-2026-000001",
      "DE-2026-000001",
      "FA-2026-000001",
    ]);
    await expect(portal.locator("thead [aria-sort]")).toHaveCount(1);
    const sortedCsv = await readCsv(page, exportButton);
    const sortedLines = sortedCsv.trim().split("\r\n");
    expect(sortedLines).toHaveLength(4);
    expect(sortedLines[0]).toContain("(EUR)");
    expect(sortedLines[1]).toContain("CO-2026-000001");
    expect(sortedLines[2]).toContain("DE-2026-000001");
    expect(sortedLines[3]).toMatch(/"FA-2026-000001".*,"9","9"$/);
    invoiceOverride = undefined;
    await page.reload();
    await expect(portal.locator("tbody tr")).toHaveCount(3);
    await capture(page, testInfo, "customer-portal-list");
    await search.fill(filters.q);
    const filterDialog = await openFilterPanel(
      page,
      filterButton,
      /^(Type de document|Document type)/,
    );
    const choiceSearch = filterDialog.getByRole("combobox", {
      name: /Rechercher une option|Search options/,
    });
    await choiceSearch.fill("zzzzzzzz");
    await expect(filterDialog.getByRole("option")).toHaveCount(0);
    await expect(filterDialog.getByRole("status")).toHaveText(
      /Aucune option ne correspond|No matching options/,
    );
    await choiceSearch.press("Enter");
    await expectFilters(page, { q: filters.q, sort: filters.sort });
    await filterDialog
      .getByRole("button", { name: /Revenir aux catégories|Back to filter categories/ })
      .click();
    await expect(
      filterDialog.getByRole("menuitem", { name: /^(Type de document|Document type)/ }),
    ).toBeFocused();
    await capture(page, testInfo, "customer-portal-filter-menu");
    await filterDialog
      .getByRole("menuitem", { name: /^(Type de document|Document type)/ })
      .press("Enter");
    await expect(choiceSearch).toHaveValue("");
    const invoiceOption = filterDialog.getByRole("option", { name: /^(Facture|Invoice)$/ });
    await choiceSearch.fill(await invoiceOption.innerText());
    await expect(filterDialog.getByRole("option")).toHaveCount(1);
    await expectFilters(page, { q: filters.q, sort: filters.sort });
    await choiceSearch.press("End");
    await choiceSearch.press("Enter");
    await expect(filterDialog).toHaveCount(0);
    await expect(filterButton).toBeFocused();
    await openFilterPanel(page, filterButton, /^(État|Status)/);
    await capture(page, testInfo, "customer-portal-status-choices");
    await filterDialog.getByRole("option", { name: /^(En cours|In progress)$/ }).click();
    await expect(filterDialog).toHaveCount(0);
    await expect(filterButton).toBeFocused();
    await expectFilters(page, filters);
    await expect(portal.locator("[appFilterChip]")).toHaveCount(3);
    await expect(portal.locator("tbody tr")).toHaveCount(1);
    await expect(documentCount).toHaveText("1 document");
    await expect(portal.locator("tbody")).toContainText(/3.?500[,.]00/);
    const filteredCsv = await readCsv(page, exportButton);
    expect(filteredCsv.trim().split("\r\n")).toHaveLength(2);
    expect(filteredCsv).toMatch(/"FA-2026-000001".*,"3600","3500"/);
    expect(filteredCsv).not.toMatch(/DE-2026-000001|CO-2026-000001|\/api\/|token|signature/i);
    expect(filteredCsv).not.toContain(quoteToken);
    await capture(page, testInfo, "customer-portal-filtered");
    await portal.locator("tbody a").click();
    await expect(page).toHaveURL(new RegExp(`${detailPath}\\?`));
    await expectFilters(page, filters);
    const detail = page.locator("app-customer-document-detail");
    await expect(detail.locator("h1")).toHaveText("FA-2026-000001");
    await page.goBack();
    await expectFilters(page, filters);
    await expect(portal.locator("tbody tr")).toHaveCount(1);
    await page.goForward();
    await expect(detail.locator("h1")).toHaveText("FA-2026-000001");
    await expectFilters(page, filters);
    const amounts = detail.locator(".invoice-balance dd");
    await expect(amounts).toHaveCount(4);
    await expect(amounts.nth(0)).toContainText(/3.?600[,.]00/);
    await expect(amounts.nth(1)).toContainText(/100[,.]00/);
    await expect(amounts.nth(2)).toContainText(/3.?500[,.]00/);
    await expect(amounts.nth(3)).not.toBeEmpty();
    await expect(detail.locator("form, iframe, input")).toHaveCount(0);
    const pdf = detail.locator("app-page-header a[download]");
    await expect(pdf).toHaveAttribute("href", `/api/client/invoices/${invoiceId}/pdf`);
    const [download] = await Promise.all([page.waitForEvent("download"), pdf.click()]);
    expect(await download.failure()).toBeNull();
    await capture(page, testInfo, "customer-invoice-detail");
    await detail.locator(".related a").click();
    await expect(detail.locator("h1")).toHaveText(invoiceSummary.orderReference);
    await expectFilters(page, filters);
    await expect(detail.locator("app-page-header a[download]")).toHaveAttribute(
      "href",
      `/api/client/orders/${invoiceSummary.orderId}/pdf`,
    );
    await detail
      .locator(`.related a[href^="/backoffice/client/documents/quote/${quoteId}"]`)
      .click();
    await expect(detail.locator("h1")).toHaveText("DE-2026-000001");
    await expectFilters(page, filters);
    await expect(detail.locator("app-page-header a[download]")).toHaveAttribute(
      "href",
      `/api/client/quotes/${quoteId}/pdf`,
    );
    await expect(detail.locator("[appNotice]")).toContainText(/lien personnel|personal link/);
    await expect(detail.locator("form, input")).toHaveCount(0);
    await capture(page, testInfo, "customer-quote-detail");
    await detail.locator(".document-page > a").click();
    await expect(page).toHaveURL(/\/backoffice\/client\?/);
    await expectFilters(page, filters);
    await expect(search).toHaveValue(filters.q);
    for (const [category, option] of [
      [/^(Type de document|Document type)/, /^(Facture|Invoice)$/],
      [/^(État|Status)/, /^(En cours|In progress)$/],
    ]) {
      await openFilterPanel(page, filterButton, category);
      await expect(filterDialog.getByRole("option", { name: option })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.keyboard.press("Escape");
      await expect(filterButton).toBeFocused();
    }
    await expect(portal.locator("tbody tr")).toHaveCount(1);

    await page.goto(`${detailPath}?${query}&unrelated=value`);
    await expect(detail.locator("h1")).toHaveText("FA-2026-000001");
    await detail.locator(".document-page > a").click();
    await expectFilters(page, filters);
    await search.fill("zzzzzzzz");
    await expect(portal.locator("app-empty-state")).toBeVisible();
    await expect(exportButton).toHaveAttribute("aria-disabled", "true");
    await capture(page, testInfo, "customer-portal-no-matches");
    await portal.locator("app-empty-state button").click();
    await expectFilters(page, { sort: filters.sort });
    await expect(search).toBeFocused();
    await expect(portal.locator("tbody tr")).toHaveCount(3);
    await openFilterPanel(page, filterButton, /^(État|Status)/);
    await filterDialog.getByRole("option", { name: /^(Terminés|Completed)$/ }).click();
    await expect(filterDialog).toHaveCount(0);
    await expect(portal.locator("tbody tr")).toHaveCount(1);
    await expect(portal.locator("tbody")).toContainText(invoiceSummary.orderReference);

    const longQuery = "x".repeat(200);
    await page.goto(
      `${detailPath}?q=${longQuery}&kind=unknown&status=unknown&sort=unknown&unrelated=value`,
    );
    await expect(detail.locator("h1")).toHaveText("FA-2026-000001");
    await detail.locator(".document-page > a").click();
    await expectFilters(page, { q: longQuery.slice(0, 120) });
    for (const [category, option] of [
      [/^(Type de document|Document type)/, /^(Tous les documents|All documents)$/],
      [/^(État|Status)/, /^(Tous les états|All statuses)$/],
    ]) {
      await openFilterPanel(page, filterButton, category);
      await expect(filterDialog.getByRole("option", { name: option })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.keyboard.press("Escape");
    }

    for (const [kind, id] of [
      ["quote", quoteId],
      ["order", invoiceSummary.orderId],
      ["invoice", invoiceId],
    ]) {
      await page.goto(`/backoffice/client?${kind}=${id}`);
      await expect(portal.locator(`#client-${kind}-${id}`)).toBeFocused();
      await expect(portal.locator(`#client-${kind}-${id}`)).toHaveClass(/target-document/);
    }

    invoiceOverride = {
      ...invoiceSummary,
      status: "issued",
      invoiceNumber: "FA-2026-000001",
      pdfAvailable: false,
      recordedPaidCents: 10000,
      creditedCents: 20000,
      remainingCents: 330000,
    };
    await page.goto(`${detailPath}?${query}`);
    await expect(detail.locator("h1")).toHaveText("FA-2026-000001");
    await expect(detail.locator("app-page-header a[download]")).toHaveCount(0);
    await expect(amounts.nth(2)).toContainText(/3.?300[,.]00/);
    await expect(detail.locator(".invoice-details > p")).toContainText(/200[,.]00/);
    await expect(detail.locator(".invoice-details a[download]")).toHaveAttribute(
      "href",
      `/api/client/invoices/${invoiceId}/credit-note/pdf`,
    );
    await capture(page, testInfo, "customer-invoice-pdf-unavailable");
    for (const status of ["paid", "void"]) {
      invoiceOverride = { ...invoiceOverride, status, remainingCents: 0 };
      await page.reload();
      await expect(detail.locator(".payment-note")).toBeVisible();
      await expect(amounts.nth(2)).toContainText(/0[,.]00/);
      await capture(page, testInfo, `customer-invoice-${status}`);
    }
    for (const path of ["invoice/invalid-id", `invoice/${clientId}`, `unknown/${invoiceId}`]) {
      await page.goto(`/backoffice/client/documents/${path}?${query}`);
      await expect(detail.getByRole("alert")).toBeVisible();
      await expect(detail.locator("a[download], .invoice-balance")).toHaveCount(0);
      await expect(detail.locator(".document-page > a")).toHaveAttribute(
        "href",
        `/backoffice/client?${query}`,
      );
    }
    await capture(page, testInfo, "customer-document-missing");
    state = "error";
    await page.goto(detailPath);
    await expect(detail.getByRole("alert")).toBeVisible();
    await capture(page, testInfo, "customer-document-error");
    state = "ready";
    invoiceOverride = undefined;
    await detail.getByRole("button", { name: /Réessayer|Try again/ }).click();
    await expect(detail.locator("h1")).toHaveText("FA-2026-000001");
    expect(administratorRequests).toEqual([]);
  } finally {
    state = "empty";
    release();
    await page.unroute(authPattern, authHandler);
    await page.unroute(listPattern, listHandler);
    await page.unroute(administratorPattern, administratorHandler);
  }
}

async function checkPublicQuote(page, testInfo) {
  let state = "loading";
  let releaseConsultation;
  const consultationPending = new Promise((resolve) => {
    releaseConsultation = resolve;
  });
  let releaseSignature;
  const signaturePending = new Promise((resolve) => {
    releaseSignature = resolve;
  });
  let signatureUnavailable = true;
  let consultation;
  const signatureRequests = [];
  const pdfRequests = [];
  const pattern = /\/api\/public\/quote-link(\/(pdf|signature))?$/;
  const acceptedAt = "2026-09-05T10:45:00.000Z";
  const handler = async (route) => {
    expect(route.request().method()).toBe("POST");
    const path = new URL(route.request().url()).pathname;
    const request = route.request().postDataJSON();
    expect(request.token).toBe(quoteToken);
    if (path.endsWith("/pdf")) {
      pdfRequests.push(request);
      return route.fallback();
    }
    if (path.endsWith("/signature")) {
      signatureRequests.push(request);
      if (signatureUnavailable) {
        await signaturePending;
        return route.fulfill({ status: 503, json: {} });
      }
      return route.fulfill({
        json: {
          quoteId,
          revisionId: consultation.snapshot.revisionId,
          signatureId: "01ARZ3NDEKTSV4RRFFQ69G5FD9",
          orderId: invoiceSummary.orderId,
          quoteReference: consultation.snapshot.quoteReference,
          orderReference: invoiceSummary.orderReference,
          status: "accepted",
          acceptedAt,
          evidenceSha256: "a".repeat(64),
        },
      });
    }
    if (state === "loading") await consultationPending;
    if (state === "error") return route.fulfill({ status: 503, json: {} });
    if (state === "expired" || state === "cancelled")
      return route.fulfill({
        status: 404,
        json: { _tag: "QuoteLinkNotFound", code: "quote_link.not_found" },
      });
    if (state === "accepted")
      return route.fulfill({ json: { ...consultation, status: "accepted", canSign: false } });
    return route.fallback();
  };
  await page.route(pattern, handler);
  try {
    await page.goto(`/quote/summary#${quoteToken}`);
    const quote = page.locator("app-public-quote");
    await expect(page.locator("app-global-search")).toHaveCount(0);
    await expect(quote.locator(".state-card h1")).toContainText(/Chargement|Loading/);
    await capture(page, testInfo, "customer-public-quote-loading");
    state = "error";
    releaseConsultation();
    await expect(quote.getByRole("alert")).toBeVisible();
    await capture(page, testInfo, "customer-public-quote-error");
    state = "ready";
    const response = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/public/quote-link",
    );
    await page.reload();
    consultation = await (await response).json();
    await expect(quote.locator("h1")).toHaveText(consultation.snapshot.title);
    await expect(quote.locator(".quote-steps a")).toHaveCount(4);
    for (const step of ["summary", "document", "signature", "confirmation"]) {
      await expect(quote.locator(`#quote-${step}-tab`)).toHaveAttribute(
        "href",
        `/quote/${step}#${quoteToken}`,
      );
    }
    await expect(quote.locator("#quote-summary-panel li")).toHaveCount(3);
    await expect(quote.locator("#quote-summary-panel .conditions")).toContainText(
      consultation.snapshot.conditions,
    );
    await expect(quote.locator(".total-card strong")).toContainText(/3.?600[,.]00/);
    await expect(quote.locator(".quote-facts")).toContainText(consultation.snapshot.quoteReference);
    await capture(page, testInfo, "customer-public-quote-summary");
    await quote.locator("#quote-confirmation-tab").click();
    await expect(quote.locator("#quote-confirmation-panel [appNotice]")).toBeVisible();
    await expect(quote.locator("#quote-confirmation-panel dl")).toHaveCount(0);
    await quote.locator("#quote-summary-tab").click();
    await quote.locator("#quote-summary-panel a[appLinkButton]").click();
    await expect(page).toHaveURL(new RegExp(`/quote/document#${quoteToken}$`));
    const documentPanel = quote.locator("#quote-document-panel");
    await expect(documentPanel.locator("iframe")).toHaveAttribute("title", /\S/);
    await expect(documentPanel.locator("iframe")).toHaveAttribute("src", /^blob:/);
    const pdf = documentPanel.locator("a[download]");
    const pdfUrl = await pdf.getAttribute("href");
    await expect(pdf).toHaveAttribute("download", `${consultation.snapshot.quoteReference}.pdf`);
    const [download] = await Promise.all([page.waitForEvent("download"), pdf.click()]);
    expect(download.suggestedFilename()).toBe(`${consultation.snapshot.quoteReference}.pdf`);
    expect(await download.failure()).toBeNull();
    await capture(page, testInfo, "customer-public-quote-document");
    await documentPanel.locator("a[appLinkButton]").click();
    await expect(page).toHaveURL(new RegExp(`/quote/signature#${quoteToken}$`));
    const signature = quote.locator("#quote-signature-panel");
    const name = signature.locator("#public-quote-signer-name");
    const typedSignature = signature.locator("#public-quote-signature");
    const consent = signature.locator('[type="checkbox"]');
    const submit = signature.locator('[type="submit"]');
    const panel = await signature.boundingBox();
    for (const input of await signature.locator("input").all()) {
      const box = await input.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
    }
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    expect(signatureRequests).toHaveLength(0);
    await name.fill("Camille Exemple");
    await submit.click();
    await expect(typedSignature).toBeFocused();
    await typedSignature.fill("Camille Exemple");
    await submit.click();
    await expect(consent).toBeFocused();
    await expect(consent).toHaveAttribute("aria-invalid", "true");
    expect(signatureRequests).toHaveLength(0);
    await consent.check();
    await quote.locator("#quote-summary-tab").click();
    await expect(page).toHaveURL(new RegExp(`/quote/summary#${quoteToken}$`));
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await quote.locator("#quote-signature-tab").click();
    await expect(name).toHaveValue("Camille Exemple");
    await expect(typedSignature).toHaveValue("Camille Exemple");
    await expect(consent).toBeChecked();
    await Promise.all([
      page.waitForEvent("dialog").then(async (dialog) => {
        expect(dialog.type()).toBe("beforeunload");
        await dialog.dismiss();
      }),
      page.evaluate(() => window.location.reload()),
    ]);
    await expect(name).toHaveValue("Camille Exemple");
    await expect(typedSignature).toHaveValue("Camille Exemple");
    await expect(consent).toBeChecked();
    await capture(page, testInfo, "customer-public-quote-signature");
    const home = page.locator("app-site-header a.brand");
    await home.click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(confirmation.locator("button").last()).toBeFocused();
    await capture(page, testInfo, "customer-public-quote-exit-confirmation");
    await page.keyboard.press("Escape");
    await expect(home).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/quote/signature#${quoteToken}$`));
    await expect(name).toHaveValue("Camille Exemple");
    await expect(typedSignature).toHaveValue("Camille Exemple");
    await expect(consent).toBeChecked();
    await submit.click();
    await expect(submit).toBeDisabled();
    for (const input of [name, typedSignature, consent]) await expect(input).toBeDisabled();
    await home.click();
    await expect(page).toHaveURL(new RegExp(`/quote/signature#${quoteToken}$`));
    await expect(confirmation).toHaveCount(0);
    await capture(page, testInfo, "customer-public-quote-signing");
    releaseSignature();
    await expect(quote.getByRole("alert")).toBeVisible();
    await expect(submit).toBeEnabled();
    await expect(name).toHaveValue("Camille Exemple");
    await expect(typedSignature).toHaveValue("Camille Exemple");
    await expect(consent).toBeChecked();
    expect(signatureRequests).toHaveLength(1);
    await capture(page, testInfo, "customer-public-quote-signature-error");
    signatureUnavailable = false;
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/quote/confirmation#${quoteToken}$`));
    const result = quote.locator("#quote-confirmation-panel");
    await expect(result.getByRole("status")).toBeVisible();
    await expect(result.locator("dd").nth(0)).toHaveText(consultation.snapshot.quoteReference);
    await expect(result.locator("dd").nth(1)).toHaveText(invoiceSummary.orderReference);
    await expect(result.locator("time")).toHaveAttribute("datetime", acceptedAt);
    await expect(result.locator("a[download]")).toHaveAttribute("href", pdfUrl);
    expect(signatureRequests).toHaveLength(2);
    expect(signatureRequests[1]).toEqual({
      token: quoteToken,
      signerName: "Camille Exemple",
      consent: true,
      signature: { kind: "typed", value: "Camille Exemple" },
    });
    expect(signatureRequests[0]).toEqual(signatureRequests[1]);
    expect(pdfRequests).toEqual([{ token: quoteToken }]);
    expect(
      await page.evaluate(
        () => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
      ),
    ).toBe(false);
    await capture(page, testInfo, "customer-public-quote-confirmation");
    await quote.locator("#quote-signature-tab").click();
    await expect(signature.locator("form")).toHaveCount(0);
    await expect(signature.getByRole("status")).toBeVisible();
    await home.click();
    await expect(page).toHaveURL(new URL("/", page.url()).href);
    await expect(confirmation).toHaveCount(0);
    for (const status of ["expired", "cancelled", "accepted"]) {
      state = status;
      const previousPdfCount = pdfRequests.length;
      const [response] = await Promise.all([
        page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === "/api/public/quote-link" &&
            response.request().method() === "POST",
        ),
        page.goto(`/quote/signature#${quoteToken}`),
      ]);
      if (status === "accepted") {
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({ status: "accepted", canSign: false });
        await expect(signature.getByRole("status")).toBeVisible();
        await expect(signature.getByRole("status")).toContainText(
          /déjà été accepté|already been accepted/,
        );
        await expect(quote.locator("h1")).toHaveText(consultation.snapshot.title);
        expect(pdfRequests).toHaveLength(previousPdfCount + 1);
      } else {
        expect(response.status()).toBe(404);
        expect(await response.json()).toEqual({
          _tag: "QuoteLinkNotFound",
          code: "quote_link.not_found",
        });
        await expect(quote.locator('.state-card[role="alert"]')).toBeVisible();
        await expect(quote.getByRole("alert")).toContainText(
          /Ce lien est indisponible|This link is unavailable/,
        );
        await expect(
          quote.locator(".quote-steps, #quote-signature-panel, iframe, a[download]"),
        ).toHaveCount(0);
        expect(pdfRequests).toHaveLength(previousPdfCount);
      }
      await expect(quote.locator('form, input, button[type="submit"]')).toHaveCount(0);
      expect(signatureRequests).toHaveLength(2);
      await capture(page, testInfo, `customer-public-quote-${status}`);
    }
    await page.goto("/quote/summary");
    await expect(quote.getByRole("alert")).toBeVisible();
    await expect(quote.locator("form, iframe, .quote-steps")).toHaveCount(0);
    await capture(page, testInfo, "customer-public-quote-missing-token");
    expect(signatureRequests).toHaveLength(2);
    state = "ready";
    await page.goto(`/quote/signature#${quoteToken}`);
    await expect(name).toBeVisible();
    await expect(name).toHaveValue("");
  } finally {
    state = "error";
    releaseConsultation();
    releaseSignature();
    await page.unroute(pattern, handler);
  }
}

export async function checkCustomerWorkspace(page, testInfo) {
  await checkPortal(page, testInfo);
  await checkPublicQuote(page, testInfo);
}
