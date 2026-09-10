import { expect } from "@playwright/test";
import { clientId, quoteId, invoiceId, invoiceSummary, issuedInvoice } from "./fixtures.mjs";
import {
  captureBankPage,
  checkBankLedger,
  chooseBankFilter,
  downloadBankCsv,
  openBankFilterPanel,
} from "./bank-ledger.mjs";

export async function checkBankingWorkspace(page, testInfo) {
  const receipt = issuedInvoice.payments[0];
  const credit = {
    id: quoteId,
    account: "MAIN",
    reference: receipt.reference,
    bookedOn: "2026-09-01",
    amountCents: 10000,
    description: `Règlement client,\r\nfacture ${issuedInvoice.invoiceNumber}`,
    importedAt: receipt.recordedAt,
    matchedCents: 0,
    allocations: [],
  };
  const debit = {
    ...credit,
    id: clientId,
    reference: "BANK-DEBIT",
    bookedOn: "2026-09-02",
    amountCents: -1234,
    description: 'Frais "service"',
    allocations: [],
  };
  const statement = `\uFEFFtransaction_id,booked_on,amount,currency,description\r\n${credit.reference},2026-09-01,100.00,EUR,"${credit.description}"\r\nBANK-DEBIT,2026-09-02,-12.34,EUR,"Frais ""service"""`;
  const invalidStatement =
    "transaction_id,booked_on,amount,currency,description\nINVALID,2026-02-30,1.001,EUR,Invalid";
  const payments = [
    { id: receipt.id, reference: "PAYMENT-PARTIAL", paidOn: receipt.paidOn, amountCents: 4000 },
    { id: clientId, reference: "PAYMENT-FEES", paidOn: receipt.paidOn, amountCents: 6300 },
  ];
  let transactions = [];
  const history = [];
  const previewRequests = [];
  const importRequests = [];
  const matchRequests = [];
  const unmatchRequests = [];
  const matchedRequests = new Map();
  const unexpected = [];
  const listGate = Promise.withResolvers();
  const firstListDone = Promise.withResolvers();
  let listCalls = 0;
  const bankingPattern = (url) =>
    url.pathname.startsWith("/api/banking/") && !url.pathname.startsWith("/api/banking/ledger");
  const invoicePattern = (url) => url.pathname === "/api/invoices";
  const invoiceHandler = (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [
            {
              ...invoiceSummary,
              status: "issued",
              invoiceNumber: issuedInvoice.invoiceNumber,
              recordedPaidCents: 10300,
            },
          ],
        })
      : route.fallback();
  const handler = async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (method === "GET" && path === "/api/banking/transactions") {
      if (++listCalls === 1) {
        try {
          await listGate.promise;
          return await route.fulfill({ status: 503, json: {} });
        } finally {
          firstListDone.resolve();
        }
      }
      return route.fulfill({ json: transactions });
    }
    if (method === "POST" && path === "/api/banking/import/preview") {
      const request = route.request().postDataJSON();
      previewRequests.push(request);
      if (request.csv === invalidStatement) {
        return route.fulfill({
          status: 422,
          json: { _tag: "BankImportInvalid", code: "bank.import_invalid" },
        });
      }
      return route.fulfill({
        json: {
          added: 2,
          existing: 0,
          rows: [credit, debit].map((transaction) => ({
            reference: transaction.reference,
            bookedOn: transaction.bookedOn,
            amountCents: transaction.amountCents,
            description: transaction.description,
            existing: false,
          })),
        },
      });
    }
    if (method === "POST" && path === "/api/banking/import") {
      importRequests.push(route.request().postDataJSON());
      // Un autre import a ajouté le débit après la prévalidation.
      transactions = [credit, debit];
      return route.fulfill({ json: { added: 1, existing: 1 } });
    }
    if (method === "GET" && path === `/api/banking/invoices/${invoiceId}/payments`) {
      return route.fulfill({
        json: payments.map((payment) => ({
          ...payment,
          availableCents:
            payment.amountCents -
            credit.allocations
              .filter((allocation) => allocation.paymentId === payment.id)
              .reduce((sum, allocation) => sum + allocation.amountCents, 0),
        })),
      });
    }
    if (method === "GET" && path === `/api/banking/transactions/${quoteId}/history`) {
      return route.fulfill({ json: history });
    }
    if (
      method === "GET" &&
      [quoteId, clientId].some((id) => path === `/api/banking/transactions/${id}`)
    ) {
      const transaction = transactions.find((item) => path.endsWith(`/${item.id}`));
      return transaction
        ? route.fulfill({ json: transaction })
        : route.fulfill({
            status: 404,
            json: { _tag: "BankTransactionNotFound", code: "bank.transaction_not_found" },
          });
    }
    if (method === "POST" && path === `/api/banking/transactions/${quoteId}/match`) {
      const request = route.request().postDataJSON();
      matchRequests.push(request);
      if (matchedRequests.has(request.requestId)) return route.fulfill({ json: transactions });
      const allocation = {
        matchId: credit.allocations.length === 0 ? invoiceId : clientId,
        paymentId: request.paymentId,
        invoiceId,
        invoiceNumber: issuedInvoice.invoiceNumber,
        amountCents: request.amountCents,
        feeCents: request.feeCents,
        paymentCancelled: false,
      };
      credit.allocations.push(allocation);
      credit.matchedCents += allocation.amountCents - allocation.feeCents;
      history.unshift({
        id: allocation.matchId,
        paymentId: allocation.paymentId,
        invoiceId,
        invoiceNumber: issuedInvoice.invoiceNumber,
        amountCents: allocation.amountCents,
        feeCents: allocation.feeCents,
        matchedAt: "2026-09-06T12:00:00.000Z",
        matchedByUserId: clientId,
        cancelledAt: null,
        cancelledByUserId: null,
        cancellationReason: null,
      });
      matchedRequests.set(request.requestId, request);
      // La reprise doit retrouver cette allocation sans en créer une deuxième.
      if (matchRequests.length === 1) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({ json: transactions });
    }
    if (method === "POST" && path === `/api/banking/transactions/${quoteId}/unmatch`) {
      const request = route.request().postDataJSON();
      unmatchRequests.push(request);
      const allocation = credit.allocations.find((item) => item.matchId === request.matchId);
      if (!allocation)
        return route.fulfill({
          status: 409,
          json: { _tag: "BankMatchConflict", code: "bank.match_conflict" },
        });
      credit.allocations = credit.allocations.filter((item) => item.matchId !== request.matchId);
      credit.matchedCents -= allocation.amountCents - allocation.feeCents;
      Object.assign(
        history.find((item) => item.id === request.matchId),
        {
          cancelledAt: "2026-09-06T13:00:00.000Z",
          cancelledByUserId: clientId,
          cancellationReason: request.reason,
        },
      );
      return route.fulfill({ json: transactions });
    }
    unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 501, json: {} });
  };
  await page.route(bankingPattern, handler);
  await page.route(invoicePattern, invoiceHandler);
  try {
    await page.goto("/backoffice/banque", { waitUntil: "domcontentloaded" });
    const banking = page.locator("app-banking");
    await expect(
      banking.locator('[role="status"]').filter({ hasText: /Chargement|Loading/ }),
    ).toBeVisible();
    await captureBankPage(page, testInfo, "banking-loading", { audit: false });
    await expect(banking.locator("app-table-export button")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    listGate.resolve();
    await expect(banking.locator('[role="alert"]')).toBeVisible();
    await captureBankPage(page, testInfo, "banking-error", { audit: false });
    await banking.getByRole("button", { name: /Recharger|Reload/ }).click();
    await expect(banking.locator("app-empty-state")).toContainText(
      /Aucune transaction importée|No imported transactions/,
    );
    await expect(banking.locator("form")).toHaveCount(0);
    await expect(banking.locator("app-table-export button")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await captureBankPage(page, testInfo, "banking-empty", { audit: false });
    await banking.locator("app-page-header a").click();

    const importer = page.locator("app-bank-import");
    const account = importer.locator("#bank-account");
    const file = importer.locator("#bank-file");
    const validate = importer.locator('button[type="submit"]');
    await expect(validate).toBeEnabled();
    await validate.click();
    await expect(account).toBeFocused();
    await expect(account).toHaveAttribute("aria-invalid", "true");
    expect(previewRequests).toHaveLength(0);
    await account.fill("MAIN");
    await validate.click();
    await expect(file).toBeFocused();
    await file.setInputFiles({
      name: "invalid-utf8.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([0xff, 0xfe, 0xff]),
    });
    await expect(importer.locator('[role="alert"]')).toBeVisible();
    expect(previewRequests).toHaveLength(0);
    await file.setInputFiles({
      name: "invalid-values.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(invalidStatement),
    });
    await validate.click();
    await expect(importer.locator('[role="alert"]')).toContainText(/Import refusé|Import rejected/);
    expect(previewRequests).toHaveLength(1);
    expect(importRequests).toHaveLength(0);
    await file.setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(statement),
    });
    await expect(validate).toBeEnabled();
    const back = importer.locator(".bank-page > a");
    await back.click();
    const confirmation = page.getByRole("alertdialog");
    await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
    await captureBankPage(page, testInfo, "banking-unsaved-dialog");
    await page.keyboard.press("Escape");
    await expect(confirmation).toBeHidden();
    await expect(back).toBeFocused();
    await expect(account).toHaveValue("MAIN");
    expect(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ).toBe(true);
    await validate.click();
    await expect(importer.locator("tbody tr")).toHaveCount(2);
    await expect(importer.locator("h2[tabindex]")).toBeFocused();
    await expect(importer.locator("tbody")).toContainText('Frais "service"');
    await expect(importer.locator("tbody")).toContainText("Règlement client,");
    expect(previewRequests[1]).toEqual({ account: "MAIN", csv: statement.slice(1) });
    expect(importRequests).toHaveLength(0);
    const previewAmount = importer.locator("thead th.amount");
    await previewAmount.getByRole("button").click();
    await expect(previewAmount).toHaveAttribute("aria-sort", "ascending");
    await expect(importer.locator("tbody tr").first()).toContainText(debit.reference);
    await expect(page).toHaveURL(/previewSort=amount-asc/);
    await captureBankPage(page, testInfo, "banking-import-review");
    await importer.getByRole("button", { name: /Confirmer l’import|Confirm import/ }).click();
    await expect(importer.locator('[role="status"]')).toContainText(
      /1 ajoutée\(s\).*1 déjà présente\(s\)|1 added.*1 already present/,
    );
    await expect(importer.locator("h2[tabindex]")).toBeFocused();
    expect(importRequests).toEqual([previewRequests[1]]);
    await expect(importer.locator("input[type=file]")).toHaveCount(0);
    await captureBankPage(page, testInfo, "banking-import-result", { audit: false });
    await importer.locator(".actions a").click();

    await expect(banking.locator("tbody tr")).toHaveCount(2);
    await expect(banking.locator("app-tabs a")).toHaveCount(2);
    await expect(banking.locator("td.amount").first()).toHaveCSS("text-align", "end");
    const amountHeader = banking.locator("thead th.amount");
    await expect(banking.locator("tbody tr").first()).toContainText(debit.reference);
    await amountHeader.getByRole("button").click();
    await expect(amountHeader).toHaveAttribute("aria-sort", "ascending");
    await amountHeader.getByRole("button").click();
    await expect(amountHeader).toHaveAttribute("aria-sort", "descending");
    await expect(banking.locator("tbody tr").first()).toContainText(credit.reference);
    await expect(banking.locator('[listSummary][role="status"]')).toHaveText(
      /^\s*2 transactions (affichées|shown)\s*$/,
    );
    const csv = await downloadBankCsv(
      page,
      banking.locator("app-table-export button"),
      "bank-transactions.csv",
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"amount_cents"');
    expect(csv.indexOf(credit.reference)).toBeLessThan(csv.indexOf(debit.reference));
    expect(csv).toContain('"-1234"');
    await captureBankPage(page, testInfo, "banking-transactions");
    const filterTrigger = banking.locator("app-filter-menu > button");
    const search = banking.getByRole("searchbox", {
      name: /Rechercher un libellé ou une référence|Search descriptions or references/,
    });
    await search.fill("reglement");
    await expect(banking.locator("tbody tr")).toHaveCount(1);
    await expect(banking.locator('[listSummary][role="status"]')).toHaveText(
      /^\s*1 transaction (affichée|shown)\s*$/,
    );
    await expect
      .poll(() => page.evaluate(() => CSS.highlights.get("search-match")?.size ?? 0))
      .toBeGreaterThan(0);
    const filteredCsv = await downloadBankCsv(
      page,
      banking.locator("app-table-export button"),
      "bank-transactions.csv",
    );
    expect(filteredCsv).toContain(credit.reference);
    expect(filteredCsv).not.toContain(debit.reference);
    const accountPanel = await openBankFilterPanel(
      page,
      banking,
      /^(Libellé du compte|Account label)/,
    );
    const choiceSearch = accountPanel.getByRole("combobox", {
      name: /Rechercher une option|Search options/,
    });
    await expect(choiceSearch).toBeFocused();
    await choiceSearch.fill("missing-account-zzzz");
    await expect(accountPanel.getByRole("option")).toHaveCount(0);
    await expect(accountPanel.getByRole("status")).toContainText(
      /Aucune option ne correspond|No matching options/,
    );
    await choiceSearch.fill("mai");
    await expect(accountPanel.getByRole("option", { name: "MAIN", exact: true })).toBeVisible();
    await captureBankPage(page, testInfo, "banking-account-filter");
    await accountPanel
      .getByRole("button", { name: /Revenir aux catégories de filtres|Back to filter categories/ })
      .click();
    const categories = page.getByRole("dialog", { name: /^(Filtres|Filters)$/ });
    await expect(categories.getByRole("menuitem")).toHaveCount(4);
    await expect(
      categories.getByRole("menuitem", { name: /^(Libellé du compte|Account label)/ }),
    ).toBeFocused();
    await expect(categories.locator("input, select, details")).toHaveCount(0);
    await categories.getByRole("menuitem", { name: /^(Libellé du compte|Account label)/ }).click();
    await expect(choiceSearch).toHaveValue("");
    await accountPanel.getByRole("option", { name: "MAIN", exact: true }).click();
    await expect(accountPanel).toBeHidden();
    await chooseBankFilter(page, banking, /^(Sens|Direction)/, /^(Crédit|Credit)$/);
    const periodPanel = await openBankFilterPanel(page, banking, /^(Période|Date range)/);
    const periodBefore = page.url();
    await periodPanel.getByLabel(/^(Début|From)$/).fill("2026-09-01");
    await periodPanel.getByLabel(/^(Fin|To)$/).fill("2026-09-01");
    await expect(page).toHaveURL(periodBefore);
    await periodPanel.getByRole("button", { name: /^(Appliquer|Apply)$/ }).click();
    await expect(periodPanel).toBeHidden();
    await chooseBankFilter(
      page,
      banking,
      /^(Rapprochement|Reconciliation)/,
      /^(À rapprocher|Unmatched)$/,
    );
    await expect(filterTrigger).toBeFocused();
    await expect(filterTrigger).toHaveAttribute("aria-label", /^(Filtres|Filters) \(4\)$/);
    await expect(banking.locator("[appFilterChip]")).toHaveCount(6);
    await expect(page).toHaveURL(/status=unmatched/);
    await page.reload();
    await expect(search).toHaveValue("reglement");
    await expect(page).toHaveURL(/sort=amount-desc/);
    await expect(banking.locator("[appFilterChip]")).toHaveCount(6);
    await expect(banking.locator("tbody tr")).toHaveCount(1);
    await search.fill("missing-bank-zzzz");
    await expect(banking.locator("app-empty-state")).toContainText(
      /ne correspond|No transactions match/,
    );
    await expect(banking.locator('[listSummary][role="status"]')).toHaveText(
      /^\s*0 (transaction affichée|transactions shown)\s*$/,
    );
    await banking.getByRole("button", { name: /Effacer les filtres|Clear filters/ }).click();
    await expect(banking.locator("[appFilterChip]")).toHaveCount(0);
    await chooseBankFilter(page, banking, /^(Sens|Direction)/, /^(Débit|Debit)$/);
    await expect(banking.locator("tbody tr")).toHaveCount(1);
    await expect(banking.locator("tbody")).toContainText(/Sans rapprochement|Not applicable/);
    await banking.getByRole("button", { name: /Effacer les filtres|Clear filters/ }).click();
    await search.fill("reglement");
    await chooseBankFilter(page, banking, /^(Sens|Direction)/, /^(Crédit|Credit)$/);
    await banking.locator("tbody a").click();

    const reconciliation = page.locator("app-bank-reconciliation");
    const matchForm = reconciliation.locator('section[aria-labelledby="allocation-title"] form');
    const invoice = matchForm.locator('[aria-describedby="invoice-error"]');
    const payment = matchForm.locator('[aria-describedby="payment-error"]');
    const amount = matchForm.locator('[aria-describedby="amount-error net-error"]');
    const fee = matchForm.locator('[aria-describedby="fee-error fee-hint"]');
    const match = matchForm.locator('button[type="submit"]');
    const allocations = reconciliation.locator('section[aria-labelledby="allocations-title"]');
    const historySection = reconciliation.locator('section[aria-labelledby="history-title"]');
    await expect(reconciliation.locator("aside h2")).toHaveText(credit.reference);
    await expect(page).toHaveURL(/sort=amount-desc/);
    await expect(historySection).toContainText(/Aucun rapprochement|No reconciliation/);
    await expect(match).toBeEnabled();
    await match.click();
    await expect(invoice).toBeFocused();
    await invoice.selectOption(invoiceId);
    await payment.selectOption(receipt.id);
    await amount.fill("40.001");
    await match.click();
    await expect(amount).toBeFocused();
    expect(matchRequests).toHaveLength(0);
    await amount.fill("40.00");
    await match.click();
    await confirmation.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
    await expect(reconciliation.locator('[role="alert"]')).toBeVisible();
    await expect(amount).toBeDisabled();
    await expect(payment).toBeDisabled();
    expect(matchRequests).toHaveLength(1);
    await match.click();
    await expect(amount).toHaveValue("60.00");
    await expect(reconciliation.locator("aside [appBadge]")).toContainText(
      /Partiellement rapproché|Partially matched/,
    );
    await expect(allocations.locator("tbody tr")).toHaveCount(1);
    await expect(reconciliation.locator('[role="status"][tabindex="-1"]')).toBeFocused();
    expect(matchRequests).toHaveLength(2);
    expect(matchRequests[1]).toEqual(matchRequests[0]);
    expect(matchRequests[0]).toEqual({
      paymentId: receipt.id,
      amountCents: 4000,
      feeCents: 0,
      requestId: expect.any(String),
    });
    await captureBankPage(page, testInfo, "banking-partial-allocation");
    await invoice.selectOption(invoiceId);
    await payment.selectOption(clientId);
    await amount.fill("63.00");
    await fee.fill("3.00");
    await match.click();
    await confirmation.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
    await expect(matchForm).toHaveCount(0);
    await expect(allocations.locator("tbody tr")).toHaveCount(2);
    expect(credit.matchedCents).toBe(10000);
    expect(matchRequests[2]).toEqual({
      paymentId: clientId,
      amountCents: 6300,
      feeCents: 300,
      requestId: expect.any(String),
    });
    expect(matchRequests[2].requestId).not.toBe(matchRequests[0].requestId);

    const feeAllocation = allocations.locator("tbody tr").filter({ hasText: clientId });
    const partialAllocation = allocations.locator("tbody tr").filter({ hasText: receipt.id });
    await allocations.locator("thead th.amount").last().getByRole("button").click();
    await expect(allocations.locator("thead th.amount").last()).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(allocations.locator("tbody tr").first()).toContainText(receipt.id);
    await feeAllocation.getByRole("button").click();
    const cancellation = allocations.locator("form");
    const reason = cancellation.locator("textarea");
    await cancellation.locator('button[type="submit"]').click();
    await expect(reason).toBeFocused();
    await expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(unmatchRequests).toHaveLength(0);
    await reason.fill("Reason attached to the fee allocation");
    await partialAllocation.getByRole("button").click();
    await confirmation.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
    await expect(reason).toHaveValue("");
    await expect(cancellation).toContainText(receipt.id);
    await feeAllocation.getByRole("button").click();
    await expect(reason).toHaveValue("");
    const cancellationReason = "Wrong fee allocation <script>preserved text</script>";
    await reason.fill(cancellationReason);
    await expect(cancellation).toContainText(clientId);
    await captureBankPage(page, testInfo, "banking-cancel-allocation");
    await cancellation.locator('button[type="submit"]').click();
    await confirmation.getByRole("button", { name: /^(Confirmer|Confirm)$/ }).click();
    await expect(cancellation).toHaveCount(0);
    await expect(allocations.locator("tbody tr")).toHaveCount(1);
    await expect(amount).toHaveValue("60.00");
    await expect(historySection).toContainText(cancellationReason);
    await expect(historySection.locator("script")).toHaveCount(0);
    await expect(reconciliation.locator('[role="status"][tabindex="-1"]')).toBeFocused();
    await expect(
      historySection
        .locator("tbody tr")
        .filter({ hasText: cancellationReason })
        .locator("td.amount")
        .last(),
    ).toContainText(/3[,.]00/);
    expect(unmatchRequests).toEqual([{ matchId: clientId, reason: cancellationReason }]);
    expect(credit.matchedCents).toBe(4000);
    await historySection.locator("thead th.amount").last().getByRole("button").click();
    await expect(historySection.locator("thead th.amount").last()).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(page).toHaveURL(/historySort=fee-asc/);
    await reconciliation.locator(".bank-page > a").click();
    await expect(page).toHaveURL(/q=reglement/);
    await expect(page).toHaveURL(/flow=credit/);
    await expect(page).toHaveURL(/sort=amount-desc/);
    await expect(banking.locator("thead th.amount")).toHaveAttribute("aria-sort", "descending");
    await expect(banking.locator("tbody tr")).toHaveCount(1);
    await expect(banking.locator("tbody [appBadge]")).toContainText(
      /Partiellement rapproché|Partially matched/,
    );
    expect(unexpected).toEqual([]);
  } finally {
    listGate.resolve();
    if (listCalls > 0) await firstListDone.promise;
    await page.unroute(bankingPattern, handler);
    await page.unroute(invoicePattern, invoiceHandler);
  }
  await checkBankLedger(page, testInfo);
}
