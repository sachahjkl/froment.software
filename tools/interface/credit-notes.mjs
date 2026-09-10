import { expect } from "@playwright/test";
import { invoiceId, clientId, invoiceSummary, issuedInvoice } from "./fixtures.mjs";
import {
  billingContext,
  captureBilling,
  checkBillingColumns,
  checkBillingCsv,
  setBillingFilter,
  setBillingPeriod,
  checkBillingGuard,
  confirmBilling,
  withBillingRoutes,
} from "./billing-workspace.mjs";

export async function checkCreditNotes(page, testInfo) {
  const invoicePath = `/backoffice/invoices/${invoiceId}`;
  const apiPath = `/api/invoices/${invoiceId}`;
  const recordedAt = "2026-09-06T12:00:00.000Z";
  const refundId = "01ARZ3NDEKTSV4RRFFQ69G5FC8";
  const creditId = "01ARZ3NDEKTSV4RRFFQ69G5FC9";
  let invoice = structuredClone(issuedInvoice);
  let state = { creditNote: null, refunds: [], refundableCents: 0 };
  const creditRequests = [];
  const refundRequests = [];
  const cancelRequests = [];
  const forbidden = [];
  let refundUnavailable = true;
  const recordRequest = (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() !== "GET" &&
      (/^\/api\/(?:banking|integrations)(?:\/|$)/.test(path) ||
        path.includes("/payments/") ||
        path.endsWith("/revisions"))
    )
      forbidden.push(path);
  };
  page.on("request", recordRequest);
  try {
    await withBillingRoutes(
      page,
      {
        [apiPath]: (route) => route.fulfill({ json: invoice }),
        "/api/invoices": (route) =>
          route.fulfill({
            json: [
              {
                ...invoiceSummary,
                ...billingContext(invoice),
                id: invoiceId,
                status: invoice.status,
                creditedCents: invoice.creditedCents,
                recordedPaidCents: 10000,
              },
            ],
          }),
        [`${apiPath}/history`]: (route) => route.fulfill({ json: [] }),
        "/api/credit-notes": (route) =>
          route.fulfill({
            json: state.creditNote ? [{ ...state.creditNote, ...billingContext(invoice) }] : [],
          }),
        "/api/invoice-refunds": (route) =>
          route.fulfill({
            json: state.refunds.map((entry) => ({ ...entry, ...billingContext(invoice) })),
          }),
        "/api/invoice-payments": (route) =>
          route.fulfill({
            json: invoice.payments.map((entry) => ({ ...entry, ...billingContext(invoice) })),
          }),
        [`${apiPath}/credits`]: (route) => {
          if (route.request().method() === "GET") return route.fulfill({ json: state });
          const request = route.request().postDataJSON();
          creditRequests.push(request);
          expect(state.creditNote).toBeNull();
          expect(request.expectedVersion).toBe(invoice.version);
          state = {
            creditNote: {
              id: creditId,
              invoiceId,
              invoiceRevisionId: invoice.currentRevision.id,
              requestId: request.requestId,
              number: "AV-2026-000001",
              reason: request.reason,
              issuedAt: recordedAt,
              issuedByUserId: clientId,
              netTotalCents: 300000,
              vatTotalCents: 60000,
              totalCents: 360000,
            },
            refunds: [],
            refundableCents: 10000,
          };
          invoice = { ...invoice, creditedCents: 360000 };
          return route.fulfill({ json: state });
        },
        [`${apiPath}/refunds`]: (route) => {
          const request = route.request().postDataJSON();
          refundRequests.push(request);
          if (!state.refunds.some((entry) => entry.requestId === request.requestId)) {
            expect(request.amountCents).toBeLessThanOrEqual(state.refundableCents);
            state.refunds.push({
              ...request,
              id: refundId,
              invoiceId,
              recordedAt,
              recordedByUserId: clientId,
              cancelledAt: null,
              cancellationReason: null,
              cancelledByUserId: null,
            });
            state.refundableCents -= request.amountCents;
          }
          return refundUnavailable
            ? route.fulfill({ status: 503, json: {} })
            : route.fulfill({ json: state });
        },
        [`${apiPath}/refunds/${refundId}/cancel`]: (route) => {
          const request = route.request().postDataJSON();
          cancelRequests.push(request);
          state = {
            ...state,
            refundableCents: 10000,
            refunds: state.refunds.map((entry) => ({
              ...entry,
              cancelledAt: recordedAt,
              cancelledByUserId: clientId,
              cancellationReason: request.reason,
            })),
          };
          return route.fulfill({ json: state });
        },
      },
      async () => {
        await page.goto("/backoffice/facturation/avoirs");
        const list = page.locator("app-credit-notes");
        await expect(list.locator("tbody")).toContainText(/Aucun élément|No recorded entries/);
        await expect(list.locator("textarea")).toHaveCount(0);
        await page.goto(invoicePath);
        const detail = page.locator("app-invoice-detail");
        await detail.locator(`a[href="${invoicePath}/credits/new"]`).click();
        const credit = page.locator("app-credit-editor");
        const reason = credit.getByRole("textbox");
        await expect(reason).toBeEnabled();
        await expect(credit).toContainText(/Un seul avoir intégral|Only one full credit note/);
        await credit.locator('button[type="submit"]').click();
        await expect(reason).toBeFocused();
        expect(creditRequests).toHaveLength(0);
        const creditReason = "<script>Service cancelled</script>";
        await reason.fill(creditReason);
        await checkBillingGuard(page, credit, reason, creditReason);
        await credit.locator('button[type="submit"]').click();
        await expect(
          page.getByRole("alertdialog").locator("[data-confirmation-cancel]"),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        expect(creditRequests).toHaveLength(0);
        await captureBilling(page, testInfo, "credit-editor");
        await credit.locator('button[type="submit"]').click();
        await confirmBilling(page);
        await expect(credit.locator('[data-task-feedback] [role="status"]')).toBeVisible();
        expect(creditRequests).toHaveLength(1);
        expect(state.creditNote.totalCents).toBe(issuedInvoice.currentRevision.totalCents);
        expect(state.creditNote.totalCents).toBeGreaterThan(0);
        await credit.locator(`a[href="${invoicePath}"]`).click();
        await expect(detail.locator(`a[href="${invoicePath}/payments/new"]`)).toHaveCount(0);
        await expect(detail.locator('a[href*="/courriels/new"]')).toHaveCount(0);
        await detail.locator('.detail-tabs a[href*="tab=credit"]').click();
        await expect(detail.locator("h2").first()).toHaveText("AV-2026-000001");
        await expect(detail).toContainText(creditReason);
        await expect(detail.locator("script")).toHaveCount(0);
        await expect(
          detail.getByRole("link", { name: /PDF de l’avoir|credit note PDF/i }),
        ).toHaveAttribute("href", `${apiPath}/credit-note/pdf`);
        await detail.locator(`a[href="${invoicePath}/refunds/new"]`).click();
        const refund = page.locator("app-refund-editor");
        const amount = refund.locator('[aria-describedby="refund-amount-error"]');
        const date = refund.locator('input[type="date"]');
        const reference = refund.locator('[aria-describedby="refund-reference-error"]');
        await expect(amount).toBeEnabled();
        await expect(refund).toContainText(
          /ne déclenche aucun virement bancaire|does not initiate a bank transfer/,
        );
        await refund.locator('button[type="submit"]').click();
        await expect(amount).toBeFocused();
        await amount.fill("100.01");
        await date.fill("2026-09-06");
        await reference.fill("REFUND-1");
        await refund.locator('button[type="submit"]').click();
        await expect(amount).toBeFocused();
        expect(refundRequests).toHaveLength(0);
        await amount.fill("60.00");
        await date.fill("2026-09-05");
        await refund.locator('button[type="submit"]').click();
        await expect(date).toBeFocused();
        expect(refundRequests).toHaveLength(0);
        await date.fill("2026-09-06");
        await checkBillingGuard(page, refund, reference, "REFUND-1");
        await captureBilling(page, testInfo, "refund-editor");
        await refund.locator('button[type="submit"]').click();
        await confirmBilling(page);
        await expect(refund.locator('[data-task-feedback] [role="alert"]').first()).toBeVisible();
        await expect(amount).toBeDisabled();
        await expect(date).toBeDisabled();
        await expect(reference).toBeDisabled();
        await expect(amount).toHaveValue("60.00");
        await refund.locator(`a[href="${invoicePath}"]`).click();
        await expect(page).toHaveURL(`${invoicePath}/refunds/new`);
        await expect(page.getByRole("alertdialog")).toHaveCount(0);
        expect(refundRequests).toHaveLength(1);
        refundUnavailable = false;
        await refund
          .getByRole("button", { name: /Réessayer la même demande|Retry the same request/ })
          .click();
        await confirmBilling(page);
        await expect(refund.locator('[data-task-feedback] [role="status"]')).toBeVisible();
        expect(refundRequests).toHaveLength(2);
        expect(refundRequests[1]).toEqual(refundRequests[0]);
        expect(state.refunds).toHaveLength(1);
        expect(state.refundableCents).toBe(4000);
        await refund.locator(`a[href="${invoicePath}"]`).click();
        await detail.locator('.detail-tabs a[href*="tab=credit"]').click();
        await expect(detail.locator("tbody tr")).toContainText("REFUND-1");
        await expect(detail).toContainText(/40[,.]00/);
        await expect(detail.locator("form")).toHaveCount(0);
        await captureBilling(page, testInfo, "credit-notes");
        await detail.locator('.detail-tabs a[href*="tab=receipts"]').click();
        await detail
          .locator(`a[href="${invoicePath}/payments/${invoice.payments[0].id}/cancel"]`)
          .click();
        const receiptCancel = page.locator("app-receipt-cancel");
        await expect(receiptCancel).toContainText(/n’est pas disponible|unavailable/);
        await expect(receiptCancel.locator("form")).toHaveCount(0);
        await receiptCancel.locator(`a[href="${invoicePath}"]`).click();
        await detail.locator('.detail-tabs a[href*="tab=credit"]').click();
        await detail.locator(`a[href="${invoicePath}/refunds/${refundId}/cancel"]`).click();
        const cancel = page.locator("app-refund-cancel");
        const cancelReason = cancel.getByRole("textbox");
        await expect(cancelReason).toBeEnabled();
        await expect(cancel).toContainText(/ne déplace aucun fonds|does not move funds/);
        await cancel.locator('button[type="submit"]').click();
        await expect(cancelReason).toBeFocused();
        expect(cancelRequests).toHaveLength(0);
        await cancelReason.fill("Wrong refund reference");
        await checkBillingGuard(page, cancel, cancelReason, "Wrong refund reference");
        await captureBilling(page, testInfo, "refund-correction");
        await cancel.locator('button[type="submit"]').click();
        await confirmBilling(page);
        await expect(cancel.locator('[data-task-feedback] [role="status"]')).toBeVisible();
        expect(cancelRequests).toEqual([{ reason: "Wrong refund reference" }]);
        await cancel.locator(`a[href="${invoicePath}"]`).click();
        await detail.locator('.detail-tabs a[href*="tab=credit"]').click();
        await expect(detail.locator("tbody tr")).toContainText("Wrong refund reference");
        await expect(detail.locator('tbody a[href$="/cancel"]')).toHaveCount(0);
        await expect(detail).toContainText(/100[,.]00/);
        await page.goto(`${invoicePath}/credits/new`);
        await expect(credit).toContainText(/n’est pas disponible|unavailable/);
        await expect(credit.locator("form")).toHaveCount(0);
        expect(creditRequests).toHaveLength(1);
        await credit.locator(`a[href="${invoicePath}"]`).click();
        await detail.locator('a[href="/backoffice/facturation"]').click();
        await page.locator('app-billing-nav a[href="/backoffice/facturation/avoirs"]').click();
        await expect(list.locator("tbody tr")).toHaveCount(1);
        await checkBillingColumns(page, list, [
          [0, "reference"],
          [1, "invoice"],
          [2, "client"],
          [3, "date"],
          [4, "amount"],
        ]);
        await expect(list.locator("thead th").last().locator("button")).toHaveCount(0);
        await list.getByRole("searchbox").fill("AV-2026-000001");
        await setBillingFilter(page, list, /Client/, invoice.currentRevision.clientDisplayName);
        await setBillingPeriod(
          page,
          list,
          /Période d’émission de l’avoir|Credit note issue date range/,
          { to: "2026-09-06" },
        );
        await checkBillingCsv(page, list, "credit-notes.csv", ["AV-2026-000001"]);
        await expect(list.locator("tbody a").first()).toHaveAttribute(
          "href",
          `${invoicePath}?tab=credit`,
        );
        await expect(list.locator("tbody")).toContainText(creditReason);
        await expect(list.locator("script")).toHaveCount(0);
        await captureBilling(page, testInfo, "credit-list");
        await list
          .locator('app-billing-nav a[href="/backoffice/facturation/remboursements"]')
          .click();
        const refunds = page.locator("app-refund-list");
        await checkBillingColumns(page, refunds, [
          [0, "reference"],
          [1, "invoice"],
          [2, "client"],
          [3, "date"],
          [4, "status"],
          [5, "amount"],
        ]);
        await setBillingFilter(
          page,
          refunds,
          /État financier|Financial status/,
          /Saisie annulée|Entry cancelled/,
        );
        await setBillingPeriod(page, refunds, /Période de remboursement|Refund date range/, {
          from: "2026-09-06",
          to: "2026-09-06",
        });
        await expect(page).toHaveURL(/status=cancelled/);
        await expect(refunds.locator("tbody tr")).toContainText("REFUND-1");
        await expect(refunds.locator("tbody tr")).toContainText(/Saisie annulée|Entry cancelled/);
        await checkBillingCsv(page, refunds, "refunds.csv", ["REFUND-1"]);
        await expect(refunds.locator("tbody a")).toHaveAttribute(
          "href",
          `${invoicePath}?tab=credit#${refundId}`,
        );
        await captureBilling(page, testInfo, "refund-list");
        expect(invoice.currentRevision).toEqual(issuedInvoice.currentRevision);
        expect(invoice.payments).toEqual(issuedInvoice.payments);
        expect(forbidden).toEqual([]);
      },
    );
  } finally {
    page.off("request", recordRequest);
  }
}
