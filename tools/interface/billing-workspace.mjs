import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { clientId, invoiceId, invoiceSummary, issuedInvoice } from "./fixtures.mjs";

const invoicePath = `/backoffice/invoices/${invoiceId}`;
const apiPath = `/api/invoices/${invoiceId}`;
const recordedAt = "2026-09-06T12:00:00.000Z";

// Le parent installe mockApi. Retirez uniquement les routes de ce helper.
export async function withBillingRoutes(page, handlers, check) {
  const installed = [];
  try {
    for (const [path, handler] of Object.entries(handlers)) {
      const match = (url) => url.pathname === path;
      await page.route(match, handler);
      installed.push([match, handler]);
    }
    await check();
  } finally {
    for (const [match, handler] of installed.reverse()) await page.unroute(match, handler);
  }
}

export function billingContext(invoice) {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.currentRevision.title,
    clientId: invoice.clientId,
    clientDisplayName: invoice.currentRevision.clientDisplayName,
    orderId: invoice.orderId,
    orderReference: invoice.orderReference,
  };
}

// Les projets du parent fournissent les vues desktop et narrow.
export async function captureBilling(page, testInfo, name) {
  await expect(page.locator("main h1")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), fullPage: true });
}

export async function checkBillingColumns(page, root, columns) {
  await expect(root.locator("button[appTableSort]")).toHaveCount(columns.length);
  const toolbar = await root.locator("app-list-toolbar").boundingBox();
  const table = await root.locator("[appDataTable]").boundingBox();
  expect(Math.abs(table.y - toolbar.y - toolbar.height - 16)).toBeLessThan(1);
  for (const [index, column] of columns) {
    const heading = root.locator("thead th").nth(index);
    const button = heading.locator("button[appTableSort]");
    const first =
      (await heading.getAttribute("aria-sort")) === "ascending" ? "descending" : "ascending";
    const second = first === "ascending" ? "descending" : "ascending";
    await button.focus();
    for (const [key, direction] of [
      ["Enter", first],
      ["Space", second],
    ]) {
      await button.press(key);
      await expect(heading).toHaveAttribute("aria-sort", direction);
      await expect(button).toBeFocused();
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("sort") ===
          `${column}-${direction === "ascending" ? "asc" : "desc"}`,
      );
    }
  }
}

async function setBillingSort(page, root, index, column, direction) {
  const heading = root.locator("thead th").nth(index);
  for (
    let attempt = 0;
    attempt < 2 && (await heading.getAttribute("aria-sort")) !== direction;
    attempt++
  ) {
    const next =
      (await heading.getAttribute("aria-sort")) === "ascending" ? "descending" : "ascending";
    await heading.locator("button[appTableSort]").press("Enter");
    await expect(heading).toHaveAttribute("aria-sort", next);
  }
  await expect(heading).toHaveAttribute("aria-sort", direction);
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("sort") === `${column}-${direction === "ascending" ? "asc" : "desc"}`,
  );
}

async function openBillingFilterPanel(page, root, label) {
  const trigger = root.locator("app-filter-menu > button");
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName(/^(Filtres|Filters)$/);
  await expect(dialog.locator("input, select, details")).toHaveCount(0);
  await expect(dialog.getByRole("menuitem").first()).toBeFocused();
  const category = dialog.getByRole("menuitem", { name: label });
  await category.focus();
  await category.press("Enter");
  await expect(dialog.getByRole("heading", { name: label })).toBeVisible();
  await expect(dialog.getByRole("menu")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  return { trigger, dialog };
}

export async function setBillingFilter(page, root, label, optionLabel) {
  const url = page.url();
  const { trigger, dialog } = await openBillingFilterPanel(page, root, label);
  let search = dialog.getByRole("combobox", { name: /Rechercher une option|Search options/ });
  await expect(search).toBeFocused();
  await search.fill("zzzzzzzzzzzz");
  await expect(dialog.getByRole("option")).toHaveCount(0);
  await expect(dialog.getByRole("status")).toContainText(/Aucune option|No matching options/);
  await expect(page).toHaveURL(url);
  await dialog
    .getByRole("button", { name: /Revenir aux catégories|Back to filter categories/ })
    .click();
  const category = dialog.getByRole("menuitem", { name: label });
  await expect(category).toBeFocused();
  await expect(dialog.getByRole("combobox")).toHaveCount(0);
  await category.press("Enter");
  search = dialog.getByRole("combobox", { name: /Rechercher une option|Search options/ });
  const option = dialog.getByRole("option", { name: optionLabel, exact: true });
  await search.fill((await option.innerText()).trim());
  await expect(option).toBeVisible();
  await expect(page).toHaveURL(url);
  await search.press("Home");
  await search.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

export async function setBillingPeriod(page, root, label, range) {
  const url = page.url();
  const { trigger, dialog } = await openBillingFilterPanel(page, root, label);
  const from = dialog.getByLabel(/^(Début|From)$/);
  const to = dialog.getByLabel(/^(Fin|To)$/);
  await expect(from).toBeFocused();
  await from.fill("2026-12-31");
  await to.fill("2026-01-01");
  await dialog.getByRole("button", { name: /^(Appliquer|Apply)$/ }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    /postérieure au début|on or after the start/,
  );
  await expect(to).toBeFocused();
  await expect(page).toHaveURL(url);
  await from.fill(range.from ?? "");
  await to.fill(range.to ?? "");
  await expect(page).toHaveURL(url);
  await dialog.getByRole("button", { name: /^(Appliquer|Apply)$/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(
    (current) =>
      current.searchParams.get("from") === (range.from ?? "") &&
      current.searchParams.get("to") === (range.to ?? ""),
  );
}

export async function checkBillingCsv(page, root, filename, references) {
  await expect(root.locator("p[listSummary]")).toHaveText(
    references.length === 1
      ? /^1 (?:résultat|result)$/
      : new RegExp(`^${references.length} (?:résultats|results)$`),
  );
  const button = root.locator("app-table-export button");
  await expect(button).toHaveAccessibleName(
    /Exporter les résultats affichés|Export displayed results/,
  );
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await button.focus();
  const hint = page.locator(`[id="${await button.getAttribute("aria-describedby")}"]`);
  await expect(hint).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(hint).toBeHidden();
  await expect(button).toBeFocused();
  const downloaded = page.waitForEvent("download");
  await button.press("Enter");
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe(filename);
  const content = await readFile(await download.path(), "utf8");
  expect(content.startsWith("\uFEFF")).toBe(true);
  const rows = content.split("\r\n").slice(1, -1);
  expect(rows).toHaveLength(references.length);
  for (const [index, reference] of references.entries())
    expect(rows[index].startsWith(`"${reference}",`)).toBe(true);
  expect(content).not.toContain(invoiceId);
  expect(content).not.toContain("requestId");
  expect(content).not.toContain("recordedByUserId");
  return content;
}

async function checkEmptyBillingExport(page, root) {
  await expect(root.locator("p[listSummary]")).toHaveText(/^(?:0 résultat|0 results)$/);
  const button = root.locator("app-table-export button");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await button.focus();
  const hint = page.locator(`[id="${await button.getAttribute("aria-describedby")}"]`);
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(/Aucun résultat affiché|no displayed results/);
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
}

export async function confirmBilling(page) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.locator("[data-confirmation-cancel]")).toBeFocused();
  await dialog.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
}

export async function checkBillingGuard(page, root, field, value) {
  const url = page.url();
  const back = root.locator(`a[href="${invoicePath}"]`);
  await expect(field).toHaveValue(value);
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  await back.click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.locator("[data-confirmation-cancel]")).toBeFocused();
  await dialog.locator("[data-confirmation-cancel]").click();
  await expect(page).toHaveURL(url);
  await expect(field).toHaveValue(value);
  await expect(back).toBeFocused();
}

async function checkInvoiceEmailRecovery(page, testInfo) {
  await page.locator(`app-invoice-detail a[href="${invoicePath}/payments/new"]`).click();
  const payment = page.locator("app-payment-editor");
  await payment
    .locator('[aria-describedby="payment-reference-error"]')
    .fill("Unsubmitted payment reference");
  await payment.locator(`a[href="${invoicePath}"]`).click();
  await confirmBilling(page);
  await expect(page.locator("app-invoice-detail .summary")).toContainText(/3.?500[,.]00/);
  await page
    .locator(`app-invoice-detail a[href="/backoffice/courriels/new?invoice=${invoiceId}"]`)
    .click();
  await expect(page.locator("#email-reference")).toHaveValue("FA-2026-000001");
  await expect(page.locator("#email-body")).toHaveValue(/3.?500[,.]00/);
  await page.locator('app-email-composer .composer button[type="submit"]').click();
  await expect(page.locator("app-email-detail [appNotice]")).toContainText(
    /courriel non envoyé|email not sent/,
  );
  await page.goto(invoicePath);
  await page
    .locator(
      `app-invoice-detail a[href="/backoffice/courriels/reminders/new?invoice=${invoiceId}"]`,
    )
    .click();
  const reminderRequests = [];
  let reminderUnavailable = true;
  const reminderPattern = "**/api/reminders/*";
  const handler = (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    reminderRequests.push({
      url: route.request().url(),
      request: route.request().postDataJSON(),
    });
    return reminderUnavailable ? route.fulfill({ status: 503, json: {} }) : route.fallback();
  };
  await page.route(reminderPattern, handler);
  try {
    const reminderDate = await page.evaluate(() =>
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    );
    await page.locator("#reminder-date").fill(reminderDate);
    await page.getByRole("button", { name: /Programmer la relance|Schedule reminder/ }).click();
    await confirmBilling(page);
    await expect(page.locator('app-reminder-editor [role="alert"]')).toBeVisible();
    await expect(page.locator("#reminder-date")).toBeDisabled();
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(page.locator("#reminder-date")).toBeDisabled();
    expect(reminderRequests).toHaveLength(1);
    reminderUnavailable = false;
    await page.getByRole("button", { name: /Reprendre cette demande|Resume this request/ }).click();
    await expect(page).toHaveURL(/courriels\/reminders$/);
    expect(reminderRequests).toHaveLength(2);
    expect(reminderRequests[1]).toEqual(reminderRequests[0]);
  } finally {
    await page.unroute(reminderPattern, handler);
  }
  await expect(page.locator("app-emails tbody")).toContainText(/Programmée|Scheduled/);
  await page.getByRole("button", { name: /Annuler la programmation|Cancel schedule/ }).click();
  await confirmBilling(page);
  await expect(page.locator("app-emails tbody")).toContainText(/Annulée|Cancelled/);
  await captureBilling(page, testInfo, "invoice-reminder-recovery");
}

export async function checkBillingWorkspace(page, testInfo) {
  const draftRevision = {
    ...structuredClone(issuedInvoice.currentRevision),
    invoiceNumber: null,
    issuedAt: null,
  };
  let invoice = {
    ...structuredClone(issuedInvoice),
    status: "draft",
    invoiceNumber: null,
    issuedAt: null,
    currentRevision: draftRevision,
    revisions: [draftRevision],
    payments: [],
  };
  const overdueId = "01ARZ3NDEKTSV4RRFFQ69G5FC1";
  const paymentId = issuedInvoice.payments[0].id;
  const extraInvoices = [
    {
      id: overdueId,
      status: "issued",
      invoiceNumber: "FA-2026-000002",
      totalCents: 20000,
      dueDate: "2020-01-01",
      pdf: { status: "ready", attempts: 1, error: null },
    },
    {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FC2",
      status: "paid",
      invoiceNumber: "FA-2026-000003",
      totalCents: 30000,
      recordedPaidCents: 30000,
      dueDate: "2020-01-01",
    },
    {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FC3",
      status: "issued",
      invoiceNumber: "FA-2026-000004",
      totalCents: 40000,
      creditedCents: 40000,
      dueDate: "2020-01-01",
    },
    {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FC4",
      status: "issued",
      invoiceNumber: "FA-2026-000005",
      totalCents: 50000,
      dueDate: "2099-01-01",
      pdf: { status: "pending", attempts: 0, error: null },
    },
  ].map((entry) => ({ ...invoiceSummary, ...entry }));
  const revisions = [];
  const issues = [];
  const payments = [];
  const cancellations = [];
  const pdfRequests = [];
  const emailSimulations = [];
  const periodExports = [];
  const periodCsv = "reference,amount_cents\r\nPERIOD-ENTRY,10000\r\n";
  const forbidden = [];
  let paymentUnavailable = true;
  let showExtraInvoices = true;
  let listUnavailable = false;
  let history = [];
  const summary = () => ({
    ...invoiceSummary,
    ...billingContext(invoice),
    id: invoice.id,
    version: invoice.version,
    status: invoice.status,
    pdf: invoice.pdf,
    recordedPaidCents: invoice.payments.reduce(
      (sum, entry) => sum + (entry.cancelledAt ? 0 : entry.amountCents),
      0,
    ),
  });
  const requests = (request) => {
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET" && /^\/api\/invoices\/[^/]+\/revisions\/\d+\/pdf$/.test(path)) {
      pdfRequests.push(request.url());
    }
    if (path === "/api/integrations/operations" && request.method() === "POST") {
      const body = request.postDataJSON();
      if (body.kind === "email" && body.expectedMode === "simulation") {
        emailSimulations.push(body);
        return;
      }
    }
    if (
      request.method() !== "GET" &&
      /^\/api\/(?:banking|integrations|invoice-refunds|credit-notes)(?:\/|$)/.test(path)
    ) {
      forbidden.push(path);
    }
  };
  page.on("request", requests);
  try {
    await withBillingRoutes(
      page,
      {
        [apiPath]: (route) => route.fulfill({ json: invoice }),
        "/api/invoices": (route) =>
          listUnavailable
            ? route.fulfill({ status: 503, json: {} })
            : route.fulfill({ json: [summary(), ...(showExtraInvoices ? extraInvoices : [])] }),
        [`${apiPath}/credits`]: (route) =>
          route.fulfill({ json: { creditNote: null, refunds: [], refundableCents: 0 } }),
        [`${apiPath}/history`]: (route) => route.fulfill({ json: history }),
        "/api/invoice-payments": (route) =>
          route.fulfill({
            json: invoice.payments.map((entry) => ({ ...entry, ...billingContext(invoice) })),
          }),
        "/api/invoice-payments/export": (route) => {
          periodExports.push(Object.fromEntries(new URL(route.request().url()).searchParams));
          return route.fulfill({ contentType: "text/csv", body: periodCsv });
        },
        "/api/credit-notes": (route) => route.fulfill({ json: [] }),
        "/api/invoice-refunds": (route) => route.fulfill({ json: [] }),
        [`/api/invoices/${overdueId}/revisions/1/pdf`]: (route) => {
          expect(route.request().method()).toBe("GET");
          return route.fulfill({
            contentType: "application/pdf",
            headers: { "content-disposition": 'attachment; filename="invoice.pdf"' },
            body: "%PDF-1.4\n%%EOF",
          });
        },
        [`${apiPath}/revisions`]: (route) => {
          const request = route.request().postDataJSON();
          revisions.push(request);
          expect(request.expectedVersion).toBe(invoice.version);
          const revision = {
            ...invoice.currentRevision,
            id: `01ARZ3NDEKTSV4RRFFQ69G5FD${invoice.version + 1}`,
            version: invoice.version + 1,
            title: request.title,
            serviceDate: request.serviceDate,
            dueDate: request.dueDate,
            paymentTerms: request.paymentTerms,
            createdAt: recordedAt,
          };
          invoice = {
            ...invoice,
            version: revision.version,
            currentRevision: revision,
            revisions: [...invoice.revisions, revision],
          };
          return route.fulfill({ json: invoice });
        },
        [`${apiPath}/issue`]: (route) => {
          const request = route.request().postDataJSON();
          issues.push(request);
          expect(request.expectedVersion).toBe(invoice.version);
          const revision = {
            ...invoice.currentRevision,
            invoiceNumber: issuedInvoice.invoiceNumber,
            issuedAt: recordedAt,
          };
          invoice = {
            ...invoice,
            status: "issued",
            invoiceNumber: revision.invoiceNumber,
            issuedAt: recordedAt,
            currentRevision: revision,
            revisions: invoice.revisions.map((entry) =>
              entry.id === revision.id ? revision : entry,
            ),
            pdf: { status: "ready", attempts: 1, error: null },
          };
          return route.fulfill({
            json: {
              invoiceId,
              revisionId: revision.id,
              version: invoice.version,
              status: "issued",
              invoiceNumber: revision.invoiceNumber,
              issuedAt: recordedAt,
            },
          });
        },
        [`${apiPath}/payments`]: (route) => {
          const request = route.request().postDataJSON();
          payments.push(request);
          // La première réponse est perdue après l’enregistrement local simulé.
          if (!invoice.payments.some((entry) => entry.requestId === request.requestId)) {
            invoice = {
              ...invoice,
              payments: [
                ...invoice.payments,
                {
                  ...request,
                  id: paymentId,
                  recordedAt,
                  recordedByUserId: clientId,
                  cancelledAt: null,
                  cancelledByUserId: null,
                  cancellationReason: null,
                },
              ],
            };
          }
          return paymentUnavailable
            ? route.fulfill({ status: 503, json: {} })
            : route.fulfill({ json: invoice });
        },
        [`${apiPath}/payments/${paymentId}/cancel`]: (route) => {
          const request = route.request().postDataJSON();
          cancellations.push(request);
          invoice = {
            ...invoice,
            payments: invoice.payments.map((entry) => ({
              ...entry,
              cancelledAt: recordedAt,
              cancelledByUserId: clientId,
              cancellationReason: request.reason,
            })),
          };
          return route.fulfill({ json: invoice });
        },
      },
      async () => {
        listUnavailable = true;
        await page.goto("/backoffice/facturation");
        const list = page.locator("app-billing");
        await expect(list.getByRole("alert")).toBeVisible();
        listUnavailable = false;
        await list.getByRole("button", { name: /Réessayer|Try again/ }).click();
        await expect(list.locator("tbody tr")).toHaveCount(5);
        await expect(list).toHaveClass(/page-container/);
        await expect(list.locator("app-billing-nav a")).toHaveCount(4);
        await checkBillingColumns(page, list, [
          [1, "number"],
          [2, "client"],
          [3, "status"],
          [4, "financial"],
          [5, "due"],
          [6, "total"],
          [7, "remaining"],
        ]);
        await expect(list.locator("thead th").first().locator("button")).toHaveCount(0);
        await setBillingSort(page, list, 6, "total", "descending");
        await expect(list.locator("tbody a").first()).toHaveAttribute("href", invoicePath);
        await setBillingSort(page, list, 5, "due", "ascending");
        await expect(list.locator("tbody a").first()).toHaveAttribute(
          "href",
          `/backoffice/invoices/${overdueId}`,
        );
        await setBillingPeriod(page, list, /Période d’échéance|Due date range/, {
          to: "2020-01-01",
        });
        await expect(list.locator("tbody tr")).toHaveCount(3);
        await setBillingPeriod(page, list, /Période d’échéance|Due date range/, {});
        await expect(list.locator("tbody tr")).toHaveCount(5);
        await list.locator('thead input[type="checkbox"]').check();
        const bulk = list.locator(".bulk-actions");
        await expect(bulk.locator("app-bulk-selection")).toHaveCount(1);
        await expect(bulk.locator("app-bulk-selection > p")).toHaveText(
          /^5 (?:factures sélectionnées|invoices selected)$/,
        );
        await expect(bulk.locator("button")).toHaveCount(3);
        const pdfButton = bulk.getByRole("button", {
          name: /^(Télécharger les PDF|Download PDFs) \(1\)$/,
        });
        await expect(pdfButton).toBeEnabled();
        const download = page.waitForEvent("download");
        await pdfButton.click();
        const downloadedPdf = await download;
        expect(await downloadedPdf.failure()).toBeNull();
        expect(downloadedPdf.suggestedFilename()).toBe("FA-2026-000002-v1.pdf");
        expect(await readFile(await downloadedPdf.path(), "utf8")).toBe("%PDF-1.4\n%%EOF");
        await expect(pdfButton).toHaveAttribute("aria-busy", "false");
        expect(pdfRequests).toHaveLength(1);
        expect(pdfRequests).toEqual([
          new URL(`/api/invoices/${overdueId}/revisions/1/pdf`, page.url()).href,
        ]);
        await bulk
          .getByRole("button", { name: /Préparer les rappels|Prepare eligible reminders/ })
          .click();
        await expect(bulk.locator("li a")).toHaveCount(1);
        await expect(bulk.locator("li a")).toHaveAttribute(
          "href",
          `/backoffice/courriels/new?invoice=${overdueId}`,
        );
        await expect(bulk.locator('a[href^="mailto:"]')).toHaveCount(0);
        expect(payments).toHaveLength(0);
        expect(issues).toHaveLength(0);
        await captureBilling(page, testInfo, "billing-selection");
        await bulk.getByRole("button", { name: /Effacer la sélection|Clear selection/ }).click();
        await expect(bulk).toHaveCount(0);
        await expect(list.locator('thead input[type="checkbox"]')).not.toBeChecked();
        await list.locator('thead input[type="checkbox"]').check();
        await setBillingFilter(
          page,
          list,
          /Statut du document|Document status/,
          /^(Émise|Issued)$/,
        );
        await expect(list.locator("tbody tr")).toHaveCount(4);
        const paidRow = list.locator("tbody tr").filter({ hasText: "FA-2026-000003" });
        await expect(paidRow.locator("td").nth(3)).toContainText(/Émise|Issued/);
        await expect(paidRow.locator("td").nth(4)).toContainText(/Réglée|Paid/);
        await setBillingSort(page, list, 6, "total", "descending");
        const invoiceCsv = await checkBillingCsv(page, list, "invoices.csv", [
          "FA-2026-000005",
          "FA-2026-000004",
          "FA-2026-000003",
          "FA-2026-000002",
        ]);
        expect(invoiceCsv).toContain('"500"');
        expect(invoiceCsv).not.toContain('"3600"');
        await setBillingSort(page, list, 5, "due", "ascending");
        await setBillingFilter(
          page,
          list,
          /Statut du document|Document status/,
          /^(Brouillon|Draft)$/,
        );
        await expect(list.locator("tbody tr")).toHaveCount(1);
        await expect(bulk).toHaveCount(0);
        await expect(list.locator("p[listSummary]")).toHaveText(/^1 (?:résultat|result)$/);
        await expect(list.locator('tbody input[type="checkbox"]')).not.toBeChecked();
        await list
          .getByRole("searchbox", { name: /Rechercher par|Search by/ })
          .fill("zzzzzzzzzzzz");
        await expect(list.locator("tbody tr")).toHaveCount(0);
        await expect(list).toContainText(/Aucun résultat|No results/);
        await checkEmptyBillingExport(page, list);
        await list.getByRole("button", { name: /Effacer les filtres|Clear filters/ }).click();
        await list.getByRole("searchbox").fill(invoiceSummary.orderReference);
        await page.reload();
        await expect(list.getByRole("searchbox")).toHaveValue(invoiceSummary.orderReference);
        await expect(list.locator("thead th").nth(5)).toHaveAttribute("aria-sort", "ascending");
        await expect(page).toHaveURL(/sort=due-asc/);
        await expect(list.locator("tbody tr")).toHaveCount(5);
        await list.locator(`tbody a[href="${invoicePath}"]`).click();
        const detail = page.locator("app-invoice-detail");
        await expect(detail.locator("form, input")).toHaveCount(0);
        await detail.locator(`a[href="${invoicePath}/edit"]`).click();
        const editor = page.locator("app-invoice-editor");
        await expect(editor.locator(".document-line")).toHaveCount(3);
        await expect(editor.locator('input[type="checkbox"]')).not.toBeChecked();
        await expect(editor.locator('button[type="submit"]')).toBeDisabled();
        const spacing = await editor
          .locator("form > label")
          .filter({ has: page.locator("textarea") })
          .evaluate((field) => ({
            actual:
              field.getBoundingClientRect().top -
              field.previousElementSibling.getBoundingClientRect().bottom,
            expected: Number.parseFloat(getComputedStyle(field.parentElement).rowGap),
          }));
        expect(spacing.expected).toBeGreaterThan(0);
        expect(Math.abs(spacing.actual - spacing.expected)).toBeLessThan(1);
        const form = await editor.locator("form").boundingBox();
        const savedSummary = await editor.locator(".saved-summary").boundingBox();
        expect(savedSummary.y).toBeGreaterThanOrEqual(form.y + form.height);
        const title = editor.locator('input[aria-describedby="invoice-title-error"]');
        await title.fill("");
        await editor.locator('button[type="submit"]').click();
        await expect(title).toBeFocused();
        expect(revisions).toHaveLength(0);
        await title.fill("Invoice workspace draft");
        const dueDate = editor.locator('input[aria-describedby="invoice-due-date-error"]');
        await dueDate.fill("2026-09-04");
        await editor.locator('button[type="submit"]').click();
        await expect(dueDate).toBeFocused();
        expect(revisions).toHaveLength(0);
        await dueDate.fill("2026-10-05");
        const quantity = editor.locator('input[aria-describedby="invoice-line-quantity-error-0"]');
        await quantity.fill("0");
        await editor.locator('button[type="submit"]').click();
        await expect(quantity).toBeFocused();
        expect(revisions).toHaveLength(0);
        await quantity.fill("1.000");
        await checkBillingGuard(page, editor, title, "Invoice workspace draft");
        await captureBilling(page, testInfo, "invoice-editor");
        await editor.locator('button[type="submit"]').click();
        await expect(editor.locator('[data-editor-feedback] [role="status"]')).toBeVisible();
        expect(revisions).toHaveLength(1);
        expect(revisions[0]).toMatchObject({ expectedVersion: 1, refreshParties: false });
        await editor.locator('input[type="checkbox"]').check();
        await editor.locator('button[type="submit"]').click();
        await expect(editor.locator('[data-editor-feedback] [role="status"]')).toBeVisible();
        expect(revisions).toHaveLength(2);
        expect(revisions[1]).toMatchObject({ expectedVersion: 2, refreshParties: true });
        await expect(editor.locator('input[type="checkbox"]')).not.toBeChecked();
        await editor.locator(`a[href="${invoicePath}"]`).click();
        await detail.locator(`a[href="${invoicePath}/issue"]`).click();
        const issue = page.locator("app-invoice-issue");
        await issue.locator('button[type="submit"]').click();
        await expect(issue.getByRole("checkbox")).toBeFocused();
        expect(issues).toHaveLength(0);
        await issue.getByRole("checkbox").check();
        await issue.locator('button[type="submit"]').click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.getByRole("alertdialog").locator("[data-confirmation-cancel]").click();
        expect(issues).toHaveLength(0);
        await captureBilling(page, testInfo, "invoice-issue");
        await issue.locator('button[type="submit"]').click();
        await confirmBilling(page);
        await expect(issue.locator('[data-task-feedback] [role="status"]')).toBeVisible();
        expect(issues).toEqual([{ expectedVersion: 3 }]);
        const issuedSnapshot = structuredClone(invoice.currentRevision);
        showExtraInvoices = false;
        await issue.locator(`a[href="${invoicePath}"]`).click();
        await expect(detail.locator("form, input")).toHaveCount(0);
        await expect(detail.locator(`a[href="${invoicePath}/edit"]`)).toHaveCount(0);
        await captureBilling(page, testInfo, "invoice-detail");
        await detail.locator('.detail-tabs a[href*="tab=document"]').click();
        await expect(detail.locator("iframe")).toHaveAttribute(
          "src",
          `${apiPath}/revisions/3/preview`,
        );
        await expect(detail.locator(`a[href="${apiPath}/revisions/3/pdf"]`)).toBeVisible();
        await captureBilling(page, testInfo, "invoice-document");
        await detail.getByRole("combobox").selectOption("1");
        await expect(detail.locator("iframe")).toHaveAttribute(
          "src",
          `${apiPath}/revisions/1/preview`,
        );
        await expect(detail.locator("a[download]")).toHaveCount(0);
        await detail.locator('.detail-tabs a[href*="tab=history"]').click();
        await expect(detail).toContainText(/Aucun événement|No recorded events/);
        await expect(detail.locator(".history-entry")).toHaveCount(0);
        history = [
          {
            id: clientId,
            action: "invoice.issued",
            actorUserId: clientId,
            resourceType: "invoice",
            resourceId: invoiceId,
            requestId: null,
            traceId: null,
            spanId: null,
            occurredAt: recordedAt,
            metadata: { version: "3" },
          },
        ];
        await page.reload();
        await expect(detail.locator(".history-entry")).toHaveCount(1);
        await expect(detail.locator(".history-entry")).toContainText(
          /Facture émise|Invoice issued/,
        );
        await captureBilling(page, testInfo, "invoice-history");
        await detail.locator('.detail-tabs a[href*="tab=summary"]').click();
        await detail.locator(`a[href="${invoicePath}/payments/new"]`).click();
        const payment = page.locator("app-payment-editor");
        const amount = payment.locator('[aria-describedby="payment-amount-error"]');
        const date = payment.locator('input[type="date"]');
        const reference = payment.locator('[aria-describedby="payment-reference-error"]');
        await expect(payment).toContainText(
          /Un test Stripe ne constitue jamais un encaissement|A Stripe test is never a receipt/,
        );
        await payment.locator('button[type="submit"]').click();
        await expect(amount).toBeFocused();
        await amount.fill("3600.01");
        await date.fill("2026-09-06");
        await reference.fill("LOCAL-RECEIPT");
        await payment.locator('button[type="submit"]').click();
        await expect(amount).toBeFocused();
        expect(payments).toHaveLength(0);
        await amount.fill("100.00");
        await checkBillingGuard(page, payment, reference, "LOCAL-RECEIPT");
        await captureBilling(page, testInfo, "receipt-editor");
        await payment.locator('button[type="submit"]').click();
        await confirmBilling(page);
        await expect(payment.locator('[data-task-feedback] [role="alert"]').first()).toBeVisible();
        await expect(reference).toBeDisabled();
        await expect(amount).toHaveValue("100.00");
        await payment.locator(`a[href="${invoicePath}"]`).click();
        await expect(page).toHaveURL(`${invoicePath}/payments/new`);
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        expect(payments).toHaveLength(1);
        paymentUnavailable = false;
        await payment
          .getByRole("button", { name: /Réessayer la même demande|Retry the same request/ })
          .click();
        await confirmBilling(page);
        await expect(payment.locator('[data-task-feedback] [role="status"]')).toBeVisible();
        expect(payments).toHaveLength(2);
        expect(payments[1]).toEqual(payments[0]);
        expect(invoice.payments).toHaveLength(1);
        await payment.locator(`a[href="${invoicePath}"]`).click();
        await expect(detail.locator(".summary")).toContainText(/3.?500[,.]00/);
        await checkInvoiceEmailRecovery(page, testInfo);
        expect(payments).toHaveLength(2);
        expect(emailSimulations).toHaveLength(1);
        await page.goto("/backoffice/facturation/encaissements");
        const receipts = page.locator("app-receipt-list");
        await expect(receipts.locator("tbody tr")).toHaveCount(1);
        await expect(receipts.locator(".payment-export")).toBeVisible();
        await checkBillingColumns(page, receipts, [
          [0, "reference"],
          [1, "invoice"],
          [2, "client"],
          [3, "date"],
          [4, "method"],
          [5, "status"],
          [6, "amount"],
        ]);
        await receipts.getByRole("searchbox").fill("LOCAL-RECEIPT");
        await setBillingFilter(page, receipts, /Client/, invoice.currentRevision.clientDisplayName);
        await setBillingFilter(
          page,
          receipts,
          /État financier|Financial status/,
          /^(Enregistré|Recorded)$/,
        );
        await setBillingPeriod(page, receipts, /Période d’encaissement|Receipt date range/, {
          from: "2026-09-06",
        });
        await checkBillingCsv(page, receipts, "receipts.csv", ["LOCAL-RECEIPT"]);
        expect(periodExports).toHaveLength(0);
        const period = receipts.locator(".payment-export");
        await period.locator("summary").click();
        await period.getByLabel(/^(Du|From)$/).fill("2026-09-01");
        await period.getByLabel(/^(Au|To)$/).fill("2026-09-30");
        const periodButton = period.getByRole("button", {
          name: /Télécharger le CSV|Download CSV/,
        });
        await periodButton.focus();
        await expect(
          page.locator(`[id="${await periodButton.getAttribute("aria-describedby")}"]`),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        const periodDownload = page.waitForEvent("download");
        await periodButton.press("Enter");
        const exportedPeriod = await periodDownload;
        expect(exportedPeriod.suggestedFilename()).toBe("invoice-payments.csv");
        expect(await readFile(await exportedPeriod.path(), "utf8")).toBe(periodCsv);
        expect(periodExports).toEqual([{ from: "2026-09-01", to: "2026-09-30" }]);
        await period.locator("summary").click();
        await captureBilling(page, testInfo, "receipt-list");
        await receipts.locator("tbody a").click();
        await expect(page).toHaveURL(new RegExp(`tab=receipts#${paymentId}$`));
        await detail.locator(`a[href="${invoicePath}/payments/${paymentId}/cancel"]`).click();
        const cancel = page.locator("app-receipt-cancel");
        const reason = cancel.getByRole("textbox", {
          name: /Motif de la correction|Correction reason/,
        });
        await expect(cancel).toContainText(/ne rembourse pas le client|does not refund the client/);
        await cancel.locator('button[type="submit"]').click();
        await expect(reason).toBeFocused();
        expect(cancellations).toHaveLength(0);
        await reason.fill("Montant saisi par erreur");
        await checkBillingGuard(page, cancel, reason, "Montant saisi par erreur");
        await captureBilling(page, testInfo, "payment-correction");
        await cancel.locator('button[type="submit"]').click();
        await confirmBilling(page);
        await expect(cancel.locator('[data-task-feedback] [role="status"]')).toBeVisible();
        expect(cancellations).toEqual([{ expectedVersion: 3, reason: "Montant saisi par erreur" }]);
        await cancel.locator(`a[href="${invoicePath}"]`).click();
        await expect(detail.locator(".summary")).toContainText(/3.?600[,.]00/);
        await expect(detail.locator(`a[href="${invoicePath}/void"]`)).toHaveCount(0);
        await detail.locator('.detail-tabs a[href*="tab=receipts"]').click();
        await expect(detail.locator("tbody tr")).toContainText("Montant saisi par erreur");
        await expect(detail.locator('tbody a[href$="/cancel"]')).toHaveCount(0);
        await page.goto("/backoffice/facturation/encaissements?status=cancelled");
        await expect(receipts.locator("tbody tr")).toContainText(/Saisie annulée|Entry cancelled/);
        expect(invoice.currentRevision).toEqual(issuedSnapshot);
        expect(revisions).toHaveLength(2);
        expect(forbidden).toEqual([]);
      },
    );
  } finally {
    page.off("request", requests);
  }
}
