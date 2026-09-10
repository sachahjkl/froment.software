import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId, invoiceId, quoteId } from "./fixtures.mjs";
import { ledgerCsv } from "../../packages/api/src/banking/ledger-export.ts";

export async function openBankFilterPanel(page, root, category) {
  await root.locator("app-filter-menu > button").click();
  const categories = page.getByRole("dialog", { name: /^(Filtres|Filters)$/ });
  await expect(categories.locator("input, select, details")).toHaveCount(0);
  await categories.getByRole("menuitem", { name: category }).click();
  const panel = page.getByRole("dialog", { name: category });
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(panel.getByRole("menu")).toHaveCount(0);
  return panel;
}

export async function chooseBankFilter(page, root, category, option) {
  const panel = await openBankFilterPanel(page, root, category);
  await expect(
    panel.getByRole("combobox", { name: /Rechercher une option|Search options/ }),
  ).toBeFocused();
  await panel.getByRole("option", { name: option, exact: true }).click();
  await expect(panel).toBeHidden();
  await expect(root.locator("app-filter-menu > button")).toBeFocused();
}

export async function downloadBankCsv(page, button, filename) {
  const [download] = await Promise.all([page.waitForEvent("download"), button.click()]);
  expect(download.suggestedFilename()).toBe(filename);
  const stream = await download.createReadStream();
  if (!stream) throw new Error("bank.test.download_missing");
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export async function captureBankPage(page, testInfo, name, { audit = true } = {}) {
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(
    page.locator(
      "app-banking, app-bank-import, app-bank-reconciliation, app-bank-ledger, app-ledger-post, app-ledger-reversal",
    ),
  ).toHaveClass(/page-container/);
  await expect(page.locator("main")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const workspace = page.locator("main [appListWorkspace]");
  if (await workspace.count()) await expect(workspace).toHaveCSS("gap", "16px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  if (audit) {
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  const size = page.viewportSize().width < 768 ? "narrow" : "desktop";
  await page.screenshot({ path: testInfo.outputPath(`${name}-${size}.png`), fullPage: true });
}

export async function checkBankLedger(page, testInfo) {
  const source = {
    sourceKind: "debit",
    sourceId: clientId,
    reference: "BANK-DEBIT",
    account: "MAIN",
    bookedOn: "2026-09-01",
    amountCents: 1234,
    entryId: null,
  };
  const entries = [];
  const feeSource = {
    ...source,
    sourceId: quoteId,
    sourceKind: "fee",
    reference: "FEE-002",
    amountCents: 300,
    bookedOn: "2026-09-02",
  };
  const listRequests = [];
  const exportRequests = [];
  const postRequests = [];
  const reverseRequests = [];
  const unexpected = [];
  const period = "from=2026-09-01&to=2026-09-06";
  const pattern = (url) =>
    url.pathname === "/api/banking/ledger" || url.pathname.startsWith("/api/banking/ledger/");
  const handler = async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    if (method === "GET" && path === "/api/banking/ledger") {
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      listRequests.push({ from, to });
      return route.fulfill({
        json: {
          sources: [source, feeSource].filter(
            (item) => item.bookedOn >= from && item.bookedOn <= to,
          ),
          entries: entries
            .filter((entry) => entry.bookedOn >= from && entry.bookedOn <= to)
            .map((entry) => ({ ...entry, sourceReference: source.reference })),
        },
      });
    }
    if (method === "GET" && path === "/api/banking/ledger/export") {
      exportRequests.push(Object.fromEntries(url.searchParams));
      return route.fulfill({
        contentType: "text/csv;charset=utf-8",
        headers: { "content-disposition": 'attachment; filename="bank-ledger.csv"' },
        body: ledgerCsv(
          entries.filter(
            (entry) =>
              entry.bookedOn >= url.searchParams.get("from") &&
              entry.bookedOn <= url.searchParams.get("to"),
          ),
        ),
      });
    }
    if (method === "GET" && path === `/api/banking/ledger/sources/debit/${source.sourceId}`) {
      return route.fulfill({ json: { source, transactionId: source.sourceId } });
    }
    if (method === "GET" && path.startsWith("/api/banking/ledger/entries/")) {
      const entry = entries.find((entry) => entry.id === path.split("/").at(-1));
      return entry
        ? route.fulfill({ json: entry })
        : route.fulfill({ status: 409, json: { _tag: "LedgerConflict", code: "ledger.conflict" } });
    }
    if (method === "POST" && path === "/api/banking/ledger") {
      const request = route.request().postDataJSON();
      postRequests.push(request);
      const existing = entries.find((entry) => entry.requestId === request.requestId);
      if (existing) return route.fulfill({ json: existing });
      const entry = {
        ...request,
        id: invoiceId,
        bookedOn: source.bookedOn,
        amountCents: source.amountCents,
        recordedAt: "2026-09-06T12:00:00.000Z",
        recordedByUserId: clientId,
        reversesId: null,
        reversalId: null,
      };
      entries.push(entry);
      source.entryId = entry.id;
      // L’écriture existe, mais sa première réponse reste incertaine pour le navigateur.
      return route.fulfill({ status: 503, json: {} });
    }
    if (method === "POST" && path === `/api/banking/ledger/${invoiceId}/reverse`) {
      const request = route.request().postDataJSON();
      reverseRequests.push(request);
      const original = entries.find((entry) => entry.id === invoiceId);
      const reversal = {
        ...original,
        id: quoteId,
        requestId: request.requestId,
        label: request.reason,
        bookedOn: request.bookedOn,
        debitAccount: original.creditAccount,
        creditAccount: original.debitAccount,
        recordedAt: "2026-09-06T13:00:00.000Z",
        reversesId: original.id,
        reversalId: null,
      };
      original.reversalId = reversal.id;
      entries.push(reversal);
      source.entryId = null;
      return route.fulfill({ json: reversal });
    }
    unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 501, json: {} });
  };
  await page.route(pattern, handler);
  try {
    await page.goto(`/backoffice/banque/ecritures?${period}`);
    const ledger = page.locator("app-bank-ledger");
    await expect(ledger).toHaveClass(/page-container/);
    await expect(ledger.locator("tbody tr")).toHaveCount(2);
    await expect(ledger.locator('[listSummary][role="status"]')).toHaveText(
      /^\s*2 (éléments affichés|items shown)\s*$/,
    );
    await expect(ledger.locator("tbody tr").first()).toContainText(feeSource.reference);
    await ledger
      .locator("thead")
      .getByRole("button", { name: /^(Type de source|Source type)\s*:/ })
      .click();
    await expect(ledger.locator("tbody tr").first()).toContainText(source.reference);
    const sourceAmount = ledger.locator("thead th.amount");
    await sourceAmount.getByRole("button").click();
    await expect(sourceAmount).toHaveAttribute("aria-sort", "ascending");
    await expect(ledger.locator("tbody tr").first()).toContainText(feeSource.reference);
    const sourceCsv = await downloadBankCsv(
      page,
      ledger.locator("app-table-export button"),
      "bank-source-results.csv",
    );
    expect(sourceCsv.indexOf(feeSource.reference)).toBeLessThan(
      sourceCsv.indexOf(source.reference),
    );
    expect(sourceCsv).toContain('"amount_cents"');
    const search = ledger.getByRole("searchbox", {
      name: /Rechercher une référence ou un libellé|Search references or labels/,
    });
    await search.fill(source.reference);
    await expect(ledger.locator("tbody tr")).toHaveCount(1);
    await expect(ledger.locator('[listSummary][role="status"]')).toHaveText(
      /^\s*1 (élément affiché|item shown)\s*$/,
    );
    await expect(ledger.locator("tbody a")).toHaveAttribute(
      "href",
      new RegExp(`/comptabiliser/debit/${clientId}`),
    );
    const filterTrigger = ledger.locator("app-filter-menu > button");
    const filters = await openBankFilterPanel(page, ledger, /^(Période|Date range)/);
    const periodForm = filters.locator("app-date-range-filter form");
    const periodEnd = periodForm.getByLabel(/^(Fin|To)$/);
    await periodEnd.fill("2026-08-31");
    await expect(periodForm.locator('button[type="submit"]')).toBeEnabled();
    await periodForm.locator('button[type="submit"]').click();
    await expect(periodEnd).toBeFocused();
    await expect(filters.getByRole("alert")).toBeVisible();
    expect(listRequests).toEqual([{ from: "2026-09-01", to: "2026-09-06" }]);
    await periodEnd.fill("");
    await periodForm.locator('button[type="submit"]').click();
    await expect(filters.getByRole("alert")).toContainText(
      /Saisissez les deux dates|Enter both dates/,
    );
    await expect(filters.getByRole("alert")).toBeFocused();
    await expect(periodForm.getByLabel(/^(Début|From)$/)).toHaveValue("2026-09-01");
    await expect(periodEnd).toHaveValue("");
    await expect(ledger.locator("a[download]")).toHaveAttribute(
      "href",
      `/api/banking/ledger/export?${period}`,
    );
    expect(listRequests).toHaveLength(1);
    await periodEnd.fill("2026-09-06");
    await periodForm.locator('button[type="submit"]').click();
    await expect(filters).toBeHidden();
    await expect(filterTrigger).toBeFocused();
    await ledger.locator('.view-nav a[href*="view=journal"]').click();
    await expect(ledger.locator("app-empty-state")).toBeVisible();
    await expect(ledger.locator('[listSummary][role="status"]')).toHaveText(
      /^\s*0 (élément affiché|items shown)\s*$/,
    );
    await captureBankPage(page, testInfo, "bank-ledger-empty", { audit: false });
    await ledger.locator('.view-nav a[href*="view=sources"]').click();
    await ledger.locator("tbody a").click();

    const post = page.locator("app-ledger-post");
    const postForm = post.locator("form");
    const debit = postForm.locator('[aria-describedby="debit-error"]');
    const credit = postForm.locator('[aria-describedby="credit-error"]');
    const label = postForm.locator('[aria-describedby="label-error"]');
    const submit = postForm.locator('button[type="submit"]');
    await expect(post.locator("aside")).toContainText(source.reference);
    await expect(page).toHaveURL(/sort=amount-asc/);
    await expect(post.locator("aside a")).toHaveAttribute(
      "href",
      `/backoffice/banque/transactions/${clientId}`,
    );
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(debit).toBeFocused();
    await expect(debit).toHaveAttribute("aria-invalid", "true");
    expect(postRequests).toHaveLength(0);
    await debit.fill("627");
    await credit.fill("627");
    await label.fill("Bank expense / Frais bancaires");
    await submit.click();
    await expect(credit).toBeFocused();
    await expect(post.locator("#credit-error")).toContainText(/différent|differ/);
    expect(postRequests).toHaveLength(0);
    await credit.fill("512");

    const back = post.locator(".bank-page > a");
    await back.click();
    await expect(page).toHaveURL(/sort=amount-asc/);
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(back).toBeFocused();
    await expect(label).toHaveValue("Bank expense / Frais bancaires");
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(true);
    const context = await post.locator("aside").boundingBox();
    const task = await postForm.boundingBox();
    if (page.viewportSize().width >= 1024)
      expect(task.x).toBeGreaterThanOrEqual(context.x + context.width);
    else expect(task.y).toBeGreaterThanOrEqual(context.y + context.height);
    await captureBankPage(page, testInfo, "bank-ledger-post");

    await submit.click();
    await expect(confirmation).toContainText(/12[,.]34/);
    await confirmation.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
    await expect(post.locator('[role="alert"]')).toBeVisible();
    await expect(debit).toBeDisabled();
    await expect(credit).toBeDisabled();
    await expect(label).toBeDisabled();
    expect(postRequests).toHaveLength(1);
    await submit.click();
    await expect(post.locator('[role="status"]')).toContainText(/enregistrée|recorded/);
    await expect(post.locator('[role="status"]')).toBeFocused();
    await expect(postForm).toHaveCount(0);
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(false);
    expect(postRequests).toHaveLength(2);
    expect(postRequests[1]).toEqual(postRequests[0]);
    expect(postRequests[0]).toEqual({
      sourceKind: "debit",
      sourceId: clientId,
      debitAccount: "627",
      creditAccount: "512",
      label: "Bank expense / Frais bancaires",
      requestId: expect.any(String),
    });
    expect(entries).toHaveLength(1);
    await back.click();
    await expect(page).toHaveURL(/sort=amount-asc/);
    await expect(ledger.locator("app-empty-state")).toBeVisible();
    await ledger.locator('.view-nav a[href*="view=journal"]').click();
    await expect(ledger.locator("tbody tr")).toHaveCount(1);
    await expect(ledger.locator("tbody")).toContainText(source.reference);
    await expect(ledger.locator("td.amount")).toHaveCSS("text-align", "end");
    await search.fill("missing-ledger-zzzz");
    await expect(ledger.locator("app-empty-state")).toBeVisible();
    await expect(ledger.locator("app-table-export button")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expect(ledger.locator("a[download]")).toContainText(
      /Journal de la période|Period journal/,
    );
    await ledger.locator("[appFilterChip]").click();
    await search.fill(source.reference);
    await expect(ledger.locator("tbody tr")).toHaveCount(1);
    await expect(page).toHaveURL(/q=BANK-DEBIT/);
    await expect(ledger.locator("a[download]")).toHaveAttribute(
      "href",
      `/api/banking/ledger/export?${period}`,
    );
    await ledger.locator("tbody a").click();

    const reversal = page.locator("app-ledger-reversal");
    const reversalForm = reversal.locator("form");
    const reason = reversalForm.locator("textarea");
    const date = reversalForm.locator('input[type="date"]');
    const reverse = reversalForm.locator('button[type="submit"]');
    await expect(reverse).toBeEnabled();
    await reverse.click();
    await expect(reason).toBeFocused();
    await reason.fill("Wrong account <b>preserved reason</b>");
    await date.fill("2026-08-31");
    await reverse.click();
    await expect(date).toBeFocused();
    await expect(date).toHaveAttribute("aria-invalid", "true");
    await date.fill("2099-01-01");
    await reverse.click();
    await expect(date).toBeFocused();
    expect(reverseRequests).toHaveLength(0);
    await date.fill("2026-09-06");
    await captureBankPage(page, testInfo, "bank-ledger-reversal");
    await reverse.click();
    await confirmation.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
    await expect(reversalForm).toHaveCount(0);
    await expect(reversal.locator('[role="status"]')).toBeFocused();
    expect(reverseRequests).toEqual([
      {
        requestId: expect.any(String),
        bookedOn: "2026-09-06",
        reason: "Wrong account <b>preserved reason</b>",
      },
    ]);
    expect(entries[0]).toMatchObject({
      debitAccount: "627",
      creditAccount: "512",
      reversalId: quoteId,
    });
    expect(entries[1]).toMatchObject({
      debitAccount: "512",
      creditAccount: "627",
      amountCents: 1234,
      reversesId: invoiceId,
    });
    await reversal.locator(`a[href*="/${quoteId}/contrepasser"]`).click();
    await expect(reversal.locator("aside h2")).toHaveText("Wrong account <b>preserved reason</b>");
    await expect(reversal.locator("aside h2 b")).toHaveCount(0);
    await expect(reversalForm).toHaveCount(0);
    await expect(reversal.locator(`a[href*="/${invoiceId}/contrepasser"]`)).toBeVisible();
    await expect(page).toHaveURL(/sort=amount-asc/);
    await reversal.locator(".bank-page > a").click();
    await expect(page).toHaveURL(/view=journal/);
    await expect(page).toHaveURL(/q=BANK-DEBIT/);
    await expect(ledger.locator("tbody tr")).toHaveCount(2);
    const journalDate = ledger.locator("thead th").filter({ hasText: /Date/ });
    await journalDate.getByRole("button").click();
    await expect(journalDate).toHaveAttribute("aria-sort", "ascending");
    await expect(ledger.locator("tbody tr").first()).toContainText(
      "Bank expense / Frais bancaires",
    );
    await journalDate.getByRole("button").click();
    await expect(journalDate).toHaveAttribute("aria-sort", "descending");
    await expect(ledger.locator("tbody tr").first()).toContainText("Wrong account");
    const journalCsv = await downloadBankCsv(
      page,
      ledger.locator("app-table-export button"),
      "bank-journal-results.csv",
    );
    expect(journalCsv.indexOf("Wrong account")).toBeLessThan(journalCsv.indexOf("Bank expense"));
    expect(journalCsv).toContain('"source_reference"');
    await search.fill("missing-journal-zzzz");
    await expect(ledger.locator("app-empty-state")).toBeVisible();
    const periodCsv = await downloadBankCsv(page, ledger.locator("a[download]"), "bank-ledger.csv");
    expect(periodCsv).toContain("Bank expense");
    expect(periodCsv).toContain("Wrong account");
    expect(exportRequests).toEqual([{ from: "2026-09-01", to: "2026-09-06" }]);
    await search.fill(source.reference);
    await expect(ledger.locator("tbody tr")).toHaveCount(2);
    await expect(ledger.locator("tbody")).toContainText(/Contrepassée|Reversed/);
    await expect(ledger.locator("[appNotice]")).toContainText(/ni un FEC|French FEC/);
    await captureBankPage(page, testInfo, "bank-ledger-journal");
    await ledger.locator('.view-nav a[href*="view=sources"]').click();
    await expect(ledger.locator("tbody tr")).toHaveCount(1);
    expect(source.entryId).toBeNull();
    expect(unexpected).toEqual([]);
  } finally {
    await page.unroute(pattern, handler);
  }
}
