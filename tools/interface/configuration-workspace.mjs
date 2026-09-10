import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function checkConfigurationWorkspace(page, testInfo) {
  await page.goto("/backoffice/configuration");
  const index = page.locator("app-configuration-index");
  await expect(page.locator("app-configuration")).toHaveClass(/page-container/);
  await expect(index.locator(".groups > section")).toHaveCount(2);
  expect(
    await index.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual([
    "/backoffice/configuration/entreprise",
    "/backoffice/configuration/conditions",
    "/backoffice/configuration/carte-de-visite",
  ]);
  await expect(
    index.locator('a[href*="/equipe"], a[href*="/api"], a[href*="/services"], a[href*="/audit"]'),
  ).toHaveCount(0);
  await index.locator('a[href$="/entreprise"]').click();
  await expect(page.locator("app-issuer-settings form fieldset")).toHaveCount(3);
  await expect(page.locator("app-configuration .page-container")).toHaveCount(0);
  const conditionRows = [
    {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAA",
      name: "Conditions 2",
      conditions: "Paiement à trente jours.",
    },
    {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAB",
      name: "Conditions 10",
      conditions: "Paiement à soixante jours.",
    },
  ];
  await page.route("**/api/quote-condition-presets", (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({ json: conditionRows });
  });
  await page.goto("/backoffice/configuration/conditions");
  await expect(page.locator("app-quote-condition-presets form")).toHaveCount(0);
  await checkColumnSort(
    page,
    page.locator("app-quote-condition-presets table"),
    0,
    "descending",
    "sort",
    "nameDesc",
  );
  const csv = await readTableCsv(
    page,
    page.locator("app-quote-condition-presets app-table-export"),
    "conditions.csv",
  );
  expect(csv.indexOf('"Conditions 10"')).toBeLessThan(csv.indexOf('"Conditions 2"'));
  await page.locator('app-quote-condition-presets a[href*="/conditions/new"]').click();
  expect(new URL(page.url()).searchParams.get("sort")).toBe("nameDesc");
  await expect(page.locator("app-condition-editor form")).toBeVisible();
  const submit = page.locator('app-condition-editor button[type="submit"]');
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator("#preset-name")).toBeFocused();
  await page.locator("#preset-conditions").fill("Conditions de démonstration");
  await expect(page.locator("app-condition-editor .preset-conditions")).toContainText(
    "Conditions de démonstration",
  );
  await page
    .locator('app-condition-editor a[href^="/backoffice/configuration/conditions"]')
    .first()
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/configuration\/conditions\/new\?/);
  await page
    .locator('app-condition-editor a[href^="/backoffice/configuration/conditions"]')
    .first()
    .click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator('app-quote-condition-presets th[aria-sort="descending"]')).toHaveCount(
    1,
  );
  await page.unroute("**/api/quote-condition-presets");
  await page.goto("/backoffice/configuration/carte-de-visite");
  await expect(page.locator("app-business-card")).toBeVisible();
  await expect(page.locator("app-configuration .page-container")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("configuration-business-card.png"),
    fullPage: true,
  });
}

export async function checkApiTokenWorkspace(page, testInfo) {
  const now = Date.now();
  await page.route("**/api/tokens", (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({
      json: {
        items: [
          {
            id: "01ARZ3NDEKTSV4RRFFQ69G5FAA",
            name: "Zebra",
            permissions: ["client.read"],
            createdAt: now,
            expiresAt: now + 86400000,
            lastUsedAt: null,
            revokedAt: null,
            rateLimitPerMinute: 60,
          },
          {
            id: "01ARZ3NDEKTSV4RRFFQ69G5FAB",
            name: "Alpha",
            permissions: ["invoice.read"],
            createdAt: now - 1000,
            expiresAt: now + 86400000,
            lastUsedAt: null,
            revokedAt: now,
            rateLimitPerMinute: 60,
          },
        ],
        nextCursor: null,
      },
    });
  });
  await page.goto("/backoffice/api");
  await expect(page.locator("app-api-tokens")).toHaveClass(/page-container/);
  await expect(page.locator("app-configuration")).toHaveCount(0);
  await expect(page.locator("app-api-tokens form")).toHaveCount(0);
  await checkColumnSort(
    page,
    page.locator("app-api-tokens table"),
    0,
    "ascending",
    "sort",
    "nameAsc",
  );
  await checkColumnSort(
    page,
    page.locator("app-api-tokens table"),
    0,
    "descending",
    "sort",
    "nameDesc",
    "Space",
  );
  await page.locator("app-api-tokens app-list-search input").fill("Zbra");
  await expect(page.locator("app-api-tokens tbody tr")).toHaveCount(1);
  const filters = page.locator("app-api-tokens app-filter-menu");
  await chooseWorkspaceFilter(page, filters, /État|Status/, /^Jetons révoqués$|^Revoked tokens$/);
  await checkEmptyExport(page, page.locator("app-api-tokens app-table-export"));
  await chooseWorkspaceFilter(
    page,
    filters,
    /État|Status/,
    /Jetons non révoqués|Tokens not revoked/,
  );
  const csv = await readTableCsv(
    page,
    page.locator("app-api-tokens app-table-export"),
    "api-token-permissions.csv",
  );
  expect(csv).toContain('"Zebra"');
  expect(csv).not.toContain('"Alpha"');
  expect(csv).not.toContain("froment_api_v1_");
  expect(csv).not.toContain("01ARZ3NDEKTSV4RRFFQ69G5FAA");
  await page.locator('app-api-tokens a[href^="/backoffice/api/new"]').click();
  expect(new URL(page.url()).searchParams.get("sort")).toBe("nameDesc");
  expect(new URL(page.url()).searchParams.get("q")).toBe("Zbra");
  expect(new URL(page.url()).searchParams.get("filter")).toBe("notRevoked");
  await expect(page.locator("app-api-token-editor")).toHaveClass(/page-container/);
  await expect(page.locator("app-api-token-editor form")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator("#api-token-permission-search").fill("paid");
  await expect(page.locator("app-api-token-editor .permission-option")).toHaveCount(1);
  await expect(page.locator("app-api-token-editor .permission-option")).toContainText(
    "invoice.mark-paid",
  );
  await expect(page.locator('app-api-token-editor button[type="submit"]')).toBeEnabled();
  await page.locator('app-api-token-editor button[type="submit"]').click();
  await expect(page.locator("#api-token-name")).toBeFocused();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("api-token-editor.png"), fullPage: true });
  await page.locator('app-api-token-editor a[href^="/backoffice/api"]').click();
  await expect(page).toHaveURL(/\/backoffice\/api\?/);
  await expect(page.locator("app-api-tokens app-list-search input")).toHaveValue("Zbra");
  await page.unroute("**/api/tokens");
}

export async function checkAuditWorkspace(page, testInfo) {
  const newest = "01ARZ3NDEKTSV4RRFFQ69G5FAX";
  const oldest = "01ARZ3NDEKTSV4RRFFQ69G5FAW";
  const requests = [];
  let denied = false;
  const endpoint = "**/api/audit-events*";
  await page.route(endpoint, (route) => {
    expect(route.request().method()).toBe("GET");
    const query = new URL(route.request().url()).searchParams;
    requests.push(Object.fromEntries(query));
    if (denied)
      return route.fulfill({
        status: 403,
        json: {
          _tag: "PermissionDenied",
          code: "authentication.permission_denied",
        },
      });
    const older = query.get("direction") === "older";
    return route.fulfill({
      json: {
        items: [
          {
            id: older ? oldest : newest,
            action: "quote.created",
            actorUserId: null,
            resourceType: "quote",
            resourceId: older ? oldest : newest,
            occurredAt: "2026-08-20T05:30:00.000Z",
          },
        ],
        previousCursor: older ? oldest : null,
        nextCursor: older ? null : newest,
      },
    });
  });
  try {
    await page.goto("/backoffice/audit?action=quote.created&resourceType=quote&limit=1");
    const panel = page.locator("app-audit");
    await expect(panel).toHaveClass(/page-container/);
    await expect(page.locator("app-configuration")).toHaveCount(0);
    await expect(panel.locator("tbody tr")).toHaveCount(1);
    await expect(panel.locator("tbody")).toContainText(newest);
    await expect(panel.locator("tbody a")).toHaveCount(0);
    const reads = requests.length;
    await checkColumnSort(page, panel.locator("table"), 1, "ascending", "pageSort", "actionAsc");
    await panel.locator("app-list-search input").fill("quote");
    await expect.poll(() => new URL(page.url()).searchParams.get("pageQ")).toBe("quote");
    await expect(panel.locator("tbody tr")).toHaveCount(1);
    expect(requests).toHaveLength(reads);
    await expect(panel.locator("#audit-page-scope")).toContainText(/50/);
    const csv = await readTableCsv(page, panel.locator("app-table-export"), "audit-page.csv");
    expect(csv).toContain('"quote.created"');
    expect(csv).not.toContain("actorUserId");
    expect(csv).not.toContain("metadata");
    const previous = panel.locator("app-result-navigation button").first();
    const next = panel.locator("app-result-navigation button").last();
    await expect(previous).toBeDisabled();
    await next.click();
    await expect(panel.locator("tbody")).toContainText(oldest);
    expect(new URL(page.url()).searchParams.get("cursor")).toBe(newest);
    expect(requests.at(-1)).toEqual({
      action: "quote.created",
      resourceType: "quote",
      limit: "1",
      cursor: newest,
      direction: "older",
    });
    await expect(next).toBeDisabled();
    await previous.click();
    await expect(panel.locator("tbody")).toContainText(newest);
    expect(new URL(page.url()).searchParams.get("direction")).toBe("newer");
    await page.goBack();
    await expect(panel.locator("tbody")).toContainText(oldest);
    await page.reload();
    await expect(panel.locator("tbody")).toContainText(oldest);
    await expect(panel.locator("app-list-search input")).toHaveValue("quote");
    await expect(panel.locator('th[aria-sort="ascending"]')).toHaveCount(1);
    const filters = panel.locator("app-filter-menu");
    await chooseWorkspaceFilter(page, filters, /^Action/, /^quote.created$/);
    await expect.poll(() => new URL(page.url()).searchParams.get("cursor")).toBeNull();
    await expect(panel.locator("tbody")).toContainText(newest);
    const readsBeforeResource = requests.length;
    const resourcePanel = await openWorkspaceFilter(
      page,
      filters,
      /Type de ressource|Resource type/,
    );
    await expect(resourcePanel.getByRole("combobox")).toHaveCount(0);
    const resource = resourcePanel.locator("#audit-resource-type");
    await resource.fill("document-revision");
    await resourcePanel.locator('button[type="submit"]').click();
    await expect.poll(() => requests.length).toBeGreaterThan(readsBeforeResource);
    expect(requests.at(-1)).toEqual({
      action: "quote.created",
      resourceType: "document-revision",
      limit: "1",
    });
    expect(new URL(page.url()).searchParams.get("pageSort")).toBe("actionAsc");
    expect(new URL(page.url()).searchParams.get("pageQ")).toBe("quote");
    await page.screenshot({ path: testInfo.outputPath("audit-page.png"), fullPage: true });
    denied = true;
    await panel.getByRole("button", { name: /Recharger cette page|Reload this page/ }).click();
    await expect(panel.getByRole("alert")).toBeVisible();
    await expect(panel.locator("tbody")).toHaveCount(0);
    await expect(previous).toBeDisabled();
    await expect(next).toBeDisabled();
  } finally {
    await page.unroute(endpoint);
  }
}

export async function openWorkspaceFilter(page, control, category) {
  const trigger = control.locator("button");
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("select")).toHaveCount(0);
  const item = dialog.getByRole("menuitem", { name: category });
  await item.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("menu")).toHaveCount(0);
  return dialog;
}

export async function chooseWorkspaceFilter(page, control, category, optionName) {
  const dialog = await openWorkspaceFilter(page, control, category);
  await dialog
    .getByRole("button", { name: /Revenir aux catégories de filtres|Back to filter categories/ })
    .click();
  await expect(dialog.getByRole("menuitem", { name: category })).toBeFocused();
  await page.keyboard.press("Enter");
  const combobox = dialog.getByRole("combobox");
  await expect(combobox).toBeFocused();
  const option = dialog.getByRole("option", { name: optionName });
  const label = (await option.innerText()).trim();
  const previousUrl = page.url();
  await combobox.fill(label);
  await expect(option).toBeVisible();
  expect(page.url()).toBe(previousUrl);
  await option.click();
  await expect(dialog).toHaveCount(0);
  await expect(control.locator("button")).toBeFocused();
}

export async function checkColumnSort(
  page,
  table,
  column,
  direction,
  parameter,
  value,
  key = "Enter",
) {
  const heading = table.locator("thead th").nth(column);
  const button = heading.locator("button[appTableSort]");
  await button.focus();
  await page.keyboard.press(key);
  await expect(heading).toHaveAttribute("aria-sort", direction);
  await expect(button).toBeFocused();
  expect(new URL(page.url()).searchParams.get(parameter)).toBe(value);
}

export async function readTableCsv(page, control, filename) {
  const button = control.locator("button");
  await expect(button).toHaveAttribute("aria-disabled", "false");
  await button.focus();
  const hint = await button.getAttribute("aria-describedby");
  await expect(page.locator(`#${hint}`)).toBeVisible();
  const received = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const download = await received;
  expect(download.suggestedFilename()).toBe(filename);
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Missing CSV download stream");
  stream.setEncoding("utf8");
  let csv = "";
  for await (const chunk of stream) csv += chunk;
  return csv;
}

export async function checkEmptyExport(page, control) {
  const button = control.locator("button");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await button.focus();
  const hint = await button.getAttribute("aria-describedby");
  await expect(page.locator(`#${hint}`)).toContainText(/Aucun résultat|no displayed results/);
  await expect(page.locator(`#${hint}`)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
}
