import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openBackOfficeNavigation } from "./dashboard-shell.mjs";

export async function checkEmailsWorkspace(page, testInfo) {
  let release;
  const historyPattern = "**/api/integrations/operations?kind=email";
  await page.route(historyPattern, async (route) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return route.fulfill({ status: 503, json: {} });
  });
  await page.goto("/backoffice/courriels");
  await expect(
    page.locator('app-emails [role="status"]').filter({ hasText: /Chargement|Loading/ }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("emails-loading.png"), fullPage: true });
  release();
  await expect(page.locator('app-emails [role="alert"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("emails-error.png"), fullPage: true });
  await page.unroute(historyPattern);
  await page
    .locator("app-emails")
    .getByRole("button", { name: /Recharger|Reload/ })
    .click();
  await expect(page.locator('app-emails [role="alert"]')).toHaveCount(0);
  await expect(page.locator("app-emails form")).toHaveCount(0);
  await expect(page.locator("app-emails app-tabs a")).toHaveCount(4);
  await page.locator("#email-templates-tab").click();
  await expect(page.locator("app-emails app-empty-state")).toBeVisible();
  await page.locator("app-emails app-page-header a").click();
  await expect(page).toHaveURL(/templates\/new/);
  await page.locator('app-email-template-editor [type="submit"]').click();
  await expect(page.locator("#template-subject")).toBeFocused();
  await page.locator("#template-subject").fill("Rappel facture / Invoice reminder");
  await page.locator("#template-body").fill("Bonjour,\n<b>Texte du modèle</b>\nCordialement.");
  await page.locator("app-email-template-editor summary").click();
  await expect(page.locator("app-email-template-editor .message-body")).toContainText(
    "<b>Texte du modèle</b>",
  );
  await expect(page.locator("app-email-template-editor .message-body b")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("email-template.png"), fullPage: true });
  await page.locator('app-email-template-editor [type="submit"]').click();
  await expect(page.locator("app-emails tbody tr")).toHaveCount(1);
  await page.locator("app-emails tbody a").click();
  await page.locator("#template-body").fill("Bonjour,\nVoici le récapitulatif.\nCordialement.");
  const templatePattern = /\/api\/email-templates\/[^/]+$/;
  await page.route(templatePattern, (route) =>
    route.fulfill({
      status: 409,
      json: { _tag: "EmailTemplateConflict", code: "email_template.conflict" },
    }),
  );
  await page.locator('app-email-template-editor [type="submit"]').click();
  await expect(page.locator('app-email-template-editor [role="alert"]')).toBeVisible();
  await expect(page.locator("#template-body")).toHaveValue(/Voici le récapitulatif/);
  await page.unroute(templatePattern);
  await page.locator('app-email-template-editor [type="submit"]').click();
  await expect(page).toHaveURL(/courriels\/templates/);
  await page.locator("#email-messages-tab").click();
  await page.locator("app-emails app-page-header a").click();
  await page.locator("#email-recipient").fill("client@example.test");
  await page.locator("#email-reference").fill("DE-2026-000001");
  await page.locator("#email-subject").fill("Votre devis / Your quote");
  await openBackOfficeNavigation(page);
  const bankLink = page.locator('a[href="/backoffice/banque"]:visible').first();
  await bankLink.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toBeVisible();
  await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
  const confirmationAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(confirmationAudit.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(bankLink).toBeFocused();
  if (await page.locator(".navigation-trigger").isVisible()) await page.keyboard.press("Escape");
  await expect(page.locator("#email-subject")).toHaveValue("Votre devis / Your quote");
  await page.getByRole("button", { name: /Enregistrer le brouillon|Save draft/ }).click();
  await expect(page).toHaveURL(/courriels\/drafts/);
  await expect(page.locator("app-emails tbody")).toContainText("Votre devis / Your quote");
  await page.reload();
  await page.locator("app-emails tbody a").click();
  await expect(page.locator("#email-recipient")).toHaveValue("client@example.test");
  await page.locator("app-object-picker > button").click();
  const picker = page.getByRole("dialog");
  await expect(picker.locator("input")).toBeFocused();
  await picker.locator("input").fill("factur");
  await expect(picker.locator(".option")).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath("email-template-picker.png"), fullPage: true });
  await picker.locator(".option").click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /^(Confirmer|Confirm)$/ })
    .click();
  await expect(page.locator("#email-recipient")).toHaveValue("client@example.test");
  await expect(page.locator("#email-reference")).toHaveValue("DE-2026-000001");
  await expect(page.locator("#email-body")).toHaveValue(/Voici le récapitulatif/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("email-composer.png"), fullPage: true });
  const formAudit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(formAudit.violations).toEqual([]);
  const requests = [];
  let fail = true;
  const operationPattern = "**/api/integrations/operations";
  await page.route(operationPattern, (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requests.push(route.request().postDataJSON());
    return fail
      ? route.fulfill({
          status: 503,
          json: { _tag: "IntegrationUnavailable", code: "integration.unavailable" },
        })
      : route.fallback();
  });
  try {
    await page.locator('app-email-composer [type="submit"]').click();
    await expect(page.locator('app-email-composer [role="alert"]')).toBeVisible();
    await expect(page.locator("#email-body")).toBeDisabled();
    expect(requests).toHaveLength(1);
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(page.locator("#email-body")).toBeDisabled();
    await expect(page.locator("#email-body")).toHaveValue(requests[0].body);
    expect(requests).toHaveLength(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("email-recovery.png"), fullPage: true });
    fail = false;
    await page.getByRole("button", { name: /Reprendre cette demande|Resume this request/ }).click();
    await expect(page).toHaveURL(/courriels\/messages\//);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toEqual(requests[0]);
    await expect(page.locator("app-email-detail .message-body")).toContainText("Bonjour");
    await expect(page.locator("app-email-detail [appNotice]")).toContainText(
      /courriel non envoyé|email not sent/,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const detailAudit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(detailAudit.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath("email-detail.png"), fullPage: true });
    await page.locator("app-email-detail .email-task > a").click();
    await expect(page.locator("app-emails tbody tr")).toHaveCount(1);
    await expect(page.locator("app-emails .message-body")).toHaveCount(0);
    await page.locator('app-emails input[type="search"]').fill("factur");
    await expect(page.locator('app-emails input[type="search"]')).toBeFocused();
    await expect(page).toHaveURL(/q=factur/);
    await page.locator("app-emails .filters-menu summary").click();
    await page.locator("app-emails select").selectOption("pending");
    await expect(page.locator("app-emails app-empty-state")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("emails-no-matches.png"), fullPage: true });
    await page.locator("app-emails select").selectOption("simulated");
    await expect(page.locator("app-emails tbody tr")).toHaveCount(1);
    await page.locator("app-emails thead th [appTableSort]").first().click();
    await expect(page).toHaveURL(/sort=subject-asc/);
    await page.locator("app-emails tbody a").click();
    await page.locator("app-email-detail .email-task > a").click();
    await expect(page).toHaveURL(/state=simulated/);
    await expect(page).toHaveURL(/q=factur/);
    await page.screenshot({ path: testInfo.outputPath("emails-list.png"), fullPage: true });
    await page.locator("app-emails [appFilterChip]").last().click();
    await expect(page.locator("app-emails [appFilterChip]")).toHaveCount(1);
    await page.locator("app-emails [appFilterChip]").click();
    await expect(page.locator('app-emails input[type="search"]')).toBeFocused();
  } finally {
    await page.unroute(operationPattern);
  }
}
