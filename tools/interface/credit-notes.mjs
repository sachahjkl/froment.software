import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { invoiceId, clientId, issuedInvoice } from "./fixtures.mjs";

export async function checkCreditNotes(page, testInfo) {
  let state = { creditNote: null, refunds: [], refundableCents: 0 };
  await page.route(`**/api/invoices/${invoiceId}`, (route) =>
    route.fulfill({ json: issuedInvoice }),
  );
  await page.route(`**/api/invoices/${invoiceId}/credits`, (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: state });
    const request = route.request().postDataJSON();
    state = {
      creditNote: {
        id: clientId,
        invoiceId,
        invoiceRevisionId: issuedInvoice.currentRevision.id,
        requestId: request.requestId,
        number: "AV-2026-000001",
        reason: request.reason,
        issuedAt: "2026-09-06T12:00:00.000Z",
        issuedByUserId: clientId,
        netTotalCents: 300000,
        vatTotalCents: 60000,
        totalCents: 360000,
      },
      refunds: [],
      refundableCents: 10000,
    };
    return route.fulfill({ json: state });
  });
  await page.route(`**/api/invoices/${invoiceId}/refunds`, (route) => {
    const request = route.request().postDataJSON();
    state.refunds.push({
      ...request,
      id: clientId,
      invoiceId,
      recordedAt: "2026-09-06T12:00:00.000Z",
      recordedByUserId: clientId,
      cancelledAt: null,
      cancellationReason: null,
      cancelledByUserId: null,
    });
    state.refundableCents -= request.amountCents;
    return route.fulfill({ json: state });
  });
  await page.goto(`/backoffice/invoices/${invoiceId}/credits`);
  await page.locator("app-credit-notes textarea").fill("<script>Service cancelled</script>");
  await page.locator('app-credit-notes form button[type="submit"]').click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("app-credit-notes h2").first()).toHaveText("AV-2026-000001");
  await expect(page.getByRole("link", { name: /PDF de l’avoir|credit note PDF/ })).toHaveAttribute(
    "href",
    `/api/invoices/${invoiceId}/credit-note/pdf`,
  );
  await page.locator("app-credit-notes form input").nth(0).fill("60.00");
  await page.locator("app-credit-notes form input").nth(1).fill("2026-09-06");
  await page.locator("app-credit-notes form input").nth(2).fill("REFUND-1");
  await page.locator('app-credit-notes form button[type="submit"]').click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("app-credit-notes li")).toContainText("REFUND-1");
  await expect(page.locator("app-credit-notes")).toContainText(/40[,.]00/);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("credit-notes.png"), fullPage: true });
}
