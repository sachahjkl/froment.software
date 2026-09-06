import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId, invoiceId, quoteId } from "./fixtures.mjs";

export async function checkBankLedger(page, testInfo) {
  const source = {
    sourceKind: "debit",
    sourceId: clientId,
    reference: "BANK-DEBIT",
    account: "BANK",
    bookedOn: "2026-09-01",
    amountCents: 1234,
    entryId: null,
  };
  const entries = [];
  await page.route("**/api/banking/ledger?*", (route) =>
    route.fulfill({ json: { entries, sources: [source] } }),
  );
  await page.route("**/api/banking/ledger", (route) => {
    const request = route.request().postDataJSON();
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
    return route.fulfill({ json: entry });
  });
  await page.route(`**/api/banking/ledger/${invoiceId}/reverse`, (route) => {
    const request = route.request().postDataJSON();
    const original = entries[0];
    const entry = {
      ...original,
      id: quoteId,
      requestId: request.requestId,
      label: request.reason,
      bookedOn: request.bookedOn,
      debitAccount: original.creditAccount,
      creditAccount: original.debitAccount,
      reversesId: original.id,
      reversalId: null,
    };
    original.reversalId = entry.id;
    entries.push(entry);
    source.entryId = null;
    return route.fulfill({ json: entry });
  });
  await page.goto("/backoffice/banque/ecritures");
  await page.locator("app-bank-ledger .sources button").click();
  await page.locator(".entry-form input").nth(0).fill("627");
  await page.locator(".entry-form input").nth(1).fill("512");
  await page.locator(".entry-form input").nth(2).fill("BANK-FEE");
  await page.locator('.entry-form button[type="submit"]').click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("app-bank-ledger .entries li")).toHaveCount(1);
  await page.locator("app-bank-ledger .entries button").click();
  await page.locator(".reversal-form input").nth(0).fill("Wrong account");
  await page.locator(".reversal-form input").nth(1).fill("2026-09-06");
  await page.locator('.reversal-form button[type="submit"]').click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("app-bank-ledger .entries li")).toHaveCount(2);
  await expect(page.locator("app-bank-ledger .sources button")).toHaveCount(1);
  await expect(page.locator("app-bank-ledger a[download]")).toHaveAttribute(
    "href",
    /\/api\/banking\/ledger\/export\?from=/,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("bank-ledger.png"), fullPage: true });
}
