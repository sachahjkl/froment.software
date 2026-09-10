import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { designWorkspaceText } from "../../packages/l10n/src/design-workspace.ts";
import {
  mockApi,
  clientId,
  quoteId,
  invoiceId,
  invoiceSummary,
  issuedInvoice,
} from "./fixtures.mjs";

const origin = "http://127.0.0.1:4300";
const sizes = [
  { name: "wide", width: 1440, cssWidth: 720, language: "en" },
  { name: "narrow", width: 640, cssWidth: 320, language: "fr" },
];
const workspaces = [
  { name: "affairs", path: "/backoffice/affaires/all", host: "app-affairs", rows: 1 },
  { name: "quote-validation", path: "/backoffice/quotes/new", host: "app-quote-editor" },
  { name: "billing", path: "/backoffice/facturation", host: "app-billing", rows: 1 },
  { name: "invoice-detail", path: `/backoffice/invoices/${invoiceId}`, host: "app-invoice-detail" },
  { name: "banking", path: "/backoffice/banque", host: "app-banking", rows: 1 },
  { name: "bank-preview", path: "/backoffice/banque/importer", host: "app-bank-import" },
  { name: "clients", path: "/backoffice/clients/active", host: "app-clients", rows: 1 },
  { name: "company", path: "/backoffice/configuration/entreprise", host: "app-issuer-settings" },
  {
    name: "conditions-empty",
    path: "/backoffice/configuration/conditions",
    host: "app-quote-condition-presets",
    empty: true,
  },
  { name: "team-empty", path: "/backoffice/equipe", host: "app-team", empty: true },
  { name: "api-empty", path: "/backoffice/api", host: "app-api-tokens", empty: true },
  { name: "services", path: "/backoffice/services", host: "app-connections", rows: 4 },
  { name: "audit-empty", path: "/backoffice/audit", host: "app-audit", empty: true },
  { name: "account-security", path: "/backoffice/account/security", host: "app-account-security" },
  { name: "design-workflows", path: "/design/workflows", host: "app-design-workspace", rows: 3 },
];

const receipt = issuedInvoice.payments[0];
// Ces valeurs suivent BankTransaction et BankImportPreview. Aucun import ne les enregistre.
const bankRow = {
  id: quoteId,
  account: "MAIN",
  reference: receipt.reference,
  bookedOn: receipt.paidOn,
  amountCents: receipt.amountCents,
  description: "Règlement local sans import",
  importedAt: receipt.recordedAt,
  matchedCents: 0,
  allocations: [],
};
const statement = `transaction_id,booked_on,amount,currency,description\r\n${bankRow.reference},${bankRow.bookedOn},100.00,EUR,${bankRow.description}\r\n`;
const previewPath = "/api/banking/import/preview";
const responses = new Map([
  ["/api/team", { members: [], invitations: [] }],
  ["/api/audit-events", { items: [], previousCursor: null, nextCursor: null }],
  ["/api/banking/transactions", [bankRow]],
  [`/api/invoices/${invoiceId}`, issuedInvoice],
  [
    "/api/invoices",
    [
      {
        ...invoiceSummary,
        status: "issued",
        invoiceNumber: issuedInvoice.invoiceNumber,
        recordedPaidCents: receipt.amountCents,
      },
    ],
  ],
]);

async function prepareWorkspace(page, workspace, report) {
  const host = page.locator(workspace.host);
  await expect(host).toBeVisible();
  if (workspace.rows !== undefined)
    await expect(host.locator("tbody tr")).toHaveCount(workspace.rows);
  if (workspace.empty) {
    if (workspace.name === "team-empty") {
      await expect(host.locator("app-filter-menu > button").first()).toBeEnabled();
      await expect(host.locator("tbody td[colspan]")).toHaveCount(2);
      for (const cell of await host.locator("tbody td[colspan]").all())
        await expect(cell).toHaveText(/\S/);
    } else {
      await expect(host.locator("p.ds-panel")).toHaveText(/\S/);
      await expect(host.locator("table")).toHaveCount(0);
    }
  }
  if (workspace.name === "company") {
    await expect(host.locator("#issuer-display-name")).toHaveValue("Entreprise de démonstration");
    await expect(host.locator("fieldset")).toHaveCount(3);
  }
  if (workspace.name === "invoice-detail") {
    await expect(host.locator("h1")).toHaveText(issuedInvoice.invoiceNumber);
    await expect(host.locator('.summary a[href*="/quotes/"]')).toBeVisible();
  }
  if (workspace.name === "account-security") {
    await expect(host.locator('input[type="password"]')).toHaveCount(3);
    await expect(host.locator('[type="submit"]')).toBeEnabled();
  }
  await expect(host.locator('[role="alert"]')).toHaveCount(0);
  if (workspace.name === "quote-validation") {
    const submit = host.locator('[type="submit"]');
    await expect(host.locator("#quote-client option")).toHaveCount(2);
    await host.locator("#quote-client").selectOption(clientId);
    await submit.click();
    await expect(host.locator("#quote-name")).toBeFocused();
    await host.locator("#quote-name").fill("Devis non enregistré");
    await host
      .locator(".document-line .description input")
      .fill(issuedInvoice.currentRevision.lines[0].description);
    const quantity = host.locator('input[aria-describedby="line-quantity-error-0"]');
    await quantity.fill("0");
    await submit.click();
    await expect(quantity).toBeFocused();
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(host.locator("#line-quantity-error-0")).toHaveText(/\S/);
  }
  if (workspace.name === "bank-preview") {
    const submit = host.locator('[type="submit"]');
    await submit.click();
    await expect(host.locator("#bank-account")).toBeFocused();
    await host.locator("#bank-account").fill(bankRow.account);
    await host.locator("#bank-file").setInputFiles({
      name: "workspace-zoom.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(statement),
    });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(host.locator("tbody tr")).toHaveCount(1);
    await expect(host.locator("h2[tabindex]")).toBeFocused();
    await expect(host.locator("tbody")).toContainText(bankRow.reference);
    expect(report.previews.at(-1)).toEqual({ account: bankRow.account, csv: statement });
    await expect(host.locator(".actions > button").first()).toBeEnabled();
  }
}

async function checkTableFocus(host) {
  const tables = [];
  for (const region of await host.locator("[appDataTable]").all()) {
    await expect(region).toHaveAttribute("tabindex", "0");
    await expect(region).toHaveAttribute("role", "region");
    await expect(region).toHaveAttribute("aria-label", /\S/);
    await region.focus();
    await region.press("ArrowRight");
    await expect(region).toBeFocused();
    const scrollable = await region.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    );
    if (scrollable)
      await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    tables.push(
      await region.evaluate((element) => ({
        label: element.getAttribute("aria-label"),
        rows: element.querySelectorAll("tbody tr").length,
        width: element.clientWidth,
        scrollWidth: element.scrollWidth,
        keyboardScrollLeft: element.scrollLeft,
        focused: document.activeElement === element,
        outlineStyle: getComputedStyle(element).outlineStyle,
      })),
    );
    await region.evaluate((element) => {
      element.scrollLeft = 0;
    });
  }
  return tables;
}

async function checkOverlayBounds(page, overlay) {
  const bounds = await overlay.boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.y).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function checkDesignControls(page, text, capture, audit) {
  const host = page.locator("app-design-workspace");
  const help = host.getByRole("button", { name: text.selectionHelp, exact: true });
  const hint = host.locator('app-hint[listSummary] [role="tooltip"]');
  await help.hover();
  await expect(hint).toHaveAttribute("popover", "hint");
  await expect(hint).toBeVisible();
  await hint.hover();
  await expect(hint).toBeVisible();
  await checkOverlayBounds(page, hint);
  await capture("hint-hover", false);
  await page.keyboard.press("Escape");
  await expect(hint).toBeHidden();
  await page.mouse.move(0, 0);
  await host.locator("app-table-export button").focus();
  await page.keyboard.press("Tab");
  await expect(help).toBeFocused();
  await expect(hint).toBeVisible();
  await expect(help).toHaveAttribute("aria-describedby", await hint.getAttribute("id"));
  await page.keyboard.press("Escape");
  await expect(hint).toBeHidden();
  await expect(help).toBeFocused();

  const filters = host.locator("app-filter-menu > button");
  await filters.focus();
  await filters.press("Enter");
  const filterDialog = page.getByRole("dialog", { name: text.filters, exact: true });
  const category = filterDialog.getByRole("menuitem");
  await expect(category).toBeFocused();
  await category.press("Enter");
  await expect(filterDialog.locator("#workspace-status input")).toBeFocused();
  await checkOverlayBounds(page, filterDialog);
  await capture("filters", audit);
  await filterDialog
    .getByRole("option")
    .filter({
      has: page.locator(".option-label", { hasText: text.draft }),
    })
    .click();
  await expect(category).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(filterDialog).toHaveCount(0);
  await expect(filters).toBeFocused();
  await host.locator("[appFilterChip]").press("Enter");
  await expect(filters).toBeFocused();
  await expect(host.locator("tbody th[scope='row']")).toHaveText(["Atlas", "Boréal", "Cobalt"]);

  const actions = host.getByRole("button", { name: `${text.rowActions} Atlas`, exact: true });
  await actions.focus();
  await actions.press("ArrowDown");
  const menu = page.getByRole("menu", { name: `${text.rowActions} Atlas`, exact: true });
  await expect(menu.getByRole("menuitem", { name: text.edit, exact: true })).toBeFocused();
  await checkOverlayBounds(page, menu);
  await capture("row-menu", false);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(actions).toBeFocused();
  await actions.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  const name = host.locator("#workspace-name");
  await expect(name).toHaveValue("Atlas");
  await name.fill("");
  await host.locator('[type="submit"]').click();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await capture("invalid-form", audit);
  await name.fill("Modification locale non appliquée");
  const sidebar = page.locator(".reference-sidebar");
  const mobile = !(await sidebar.isVisible());
  if (mobile) await page.locator(".reference-mobile-header button").click();
  const navigation = mobile ? page.getByRole("dialog") : sidebar;
  const departure = navigation.locator('[data-reference-link="button"]');
  await departure.click();
  const confirmation = page.getByRole("alertdialog");
  await expect(confirmation).toContainText(text.discard);
  await expect(confirmation.locator("[data-confirmation-cancel]")).toBeFocused();
  await checkOverlayBounds(page, confirmation);
  await capture("form-guard", audit);
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(page).toHaveURL(`${origin}/design/workflows`);
  await expect(name).toHaveValue("Modification locale non appliquée");
  await expect(departure).toBeFocused();
  if (mobile) {
    await page.keyboard.press("Escape");
    await expect(navigation).toHaveCount(0);
    await expect(page.locator(".reference-mobile-header button")).toBeFocused();
  }
  await host.getByRole("button", { name: text.cancel, exact: true }).click();
  await confirmation.getByRole("button", { name: text.discardLabel, exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(host.locator("tbody tr")).toHaveCount(3);
}

async function checkStackedGuard(page, capture) {
  const trigger = page.locator("app-back-office-header .navigation-trigger");
  await trigger.click();
  const drawer = page.locator('[role="dialog"]');
  await expect(drawer.locator("[data-drawer-close]")).toBeFocused();
  const departure = drawer.locator('a[href="/backoffice/banque"]');
  await departure.click();
  const confirmation = page.getByRole("alertdialog");
  const cancel = confirmation.locator("[data-confirmation-cancel]");
  await expect(cancel).toBeFocused();
  await expect(drawer).toBeVisible();
  await checkOverlayBounds(page, confirmation);
  expect(
    await cancel.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
      );
    }),
  ).toBe(true);
  await cancel.press("Shift+Tab");
  await expect(confirmation.locator("button").last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  await capture("stacked-guard", true);
  await page.keyboard.press("Escape");
  await expect(confirmation).toHaveCount(0);
  await expect(drawer).toBeVisible();
  await expect(departure).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator("#quote-name")).toHaveValue("Devis non enregistré");
  await expect(page).toHaveURL(`${origin}/backoffice/quotes/new`);
}

// Appelez ce helper depuis un test existant. Le budget de 120 secondes reste un objectif mesuré.
export async function checkWorkspaceZoom(testInfo) {
  const started = Date.now();
  const profile = await mkdtemp(testInfo.outputPath("workspace-zoom-profile-"));
  const report = {
    targetDurationMs: 120000,
    matrix: sizes.map((size) => ({ ...size, themes: ["light", "dark"], zoom: 2 })),
    snapshots: [],
    apiRequests: [],
    previews: [],
    blockedRequests: [],
    unexpectedApi: [],
    pageErrors: [],
    unexpectedDialogs: [],
    completed: false,
  };
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--window-size=1440,1000"],
      viewport: null,
      baseURL: origin,
      locale: "fr-FR",
      reducedMotion: "reduce",
      colorScheme: "light",
      serviceWorkers: "block",
    });
    const page = context.pages()[0];
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("dialog", async (dialog) => {
      if (dialog.type() === "beforeunload") return dialog.accept();
      report.unexpectedDialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.dismiss();
    });
    report.unexpectedApi = await mockApi(page);
    // mockApi traite les lectures. Bloquez toute écriture, sauf la prévalidation locale et le renouvellement fictif.
    await page.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const path = url.pathname;
      const call = { method, path };
      if (url.origin !== origin) {
        report.blockedRequests.push({ method, url: url.href });
        return route.abort("blockedbyclient");
      }
      if (path.startsWith("/api/")) {
        report.apiRequests.push(call);
        if (method === "POST" && path === previewPath) {
          report.previews.push(request.postDataJSON());
          return route.fulfill({
            json: {
              added: 1,
              existing: 0,
              rows: [
                {
                  reference: bankRow.reference,
                  bookedOn: bankRow.bookedOn,
                  amountCents: bankRow.amountCents,
                  description: bankRow.description,
                  existing: false,
                },
              ],
            },
          });
        }
        if (method === "POST" && path === "/api/auth/refresh") return route.fallback();
        if (method === "GET") {
          if (responses.has(path)) return route.fulfill({ json: responses.get(path) });
          return route.fallback();
        }
      } else if (method === "GET") return route.fallback();
      report.blockedRequests.push(call);
      return route.abort("blockedbyclient");
    });
    await page.goto("/design/workflows");
    await expect(page.locator("app-design-workspace tbody tr")).toHaveCount(3);
    const zoomMetrics = () =>
      page.evaluate(() => ({
        devicePixelRatio,
        innerWidth,
        scale: visualViewport.scale,
      }));
    report.beforeZoom = await zoomMetrics();
    expect(report.beforeZoom).toEqual({ devicePixelRatio: 1, innerWidth: 1440, scale: 1 });
    const settings = await context.newPage();
    try {
      await settings.goto("chrome://settings/appearance", { waitUntil: "commit" });
      await settings.evaluate(
        () => new Promise((resolve) => chrome.settingsPrivate.setDefaultZoom(2, resolve)),
      );
    } finally {
      await settings.close();
    }
    await page.bringToFront();
    await expect.poll(zoomMetrics).toEqual({ devicePixelRatio: 2, innerWidth: 720, scale: 1 });
    report.afterZoom = await zoomMetrics();
    const protocol = await context.newCDPSession(page);
    const { windowId } = await protocol.send("Browser.getWindowForTarget");
    for (const size of sizes) {
      // Redimensionnez la fenêtre native. N'utilisez pas l'émulation du viewport ou le zoom CSS.
      await protocol.send("Browser.setWindowBounds", {
        windowId,
        bounds: { width: size.width, height: 1000 },
      });
      await expect
        .poll(zoomMetrics)
        .toEqual({ devicePixelRatio: 2, innerWidth: size.cssWidth, scale: 1 });
      await page.evaluate(
        (language) => localStorage.setItem("froment.software.language", language),
        size.language,
      );
      for (const workspace of workspaces) {
        await page.goto(workspace.path);
        await expect(page.locator("html")).toHaveAttribute("lang", size.language);
        await prepareWorkspace(page, workspace, report);
        await page.evaluate(() => document.fonts.ready.then(() => undefined));
        for (const theme of ["light", "dark"]) {
          await page.emulateMedia({ colorScheme: theme });
          await page.evaluate((value) => {
            document.documentElement.dataset.theme = value;
          }, theme);
          const tableFocusChecks = await checkTableFocus(page.locator(workspace.host));
          const capture = async (state, audit) => {
            const name = `workspace-zoom-200-${size.name}-${size.language}-${theme}-${workspace.name}-${state}`;
            const metrics = await page.evaluate(() => ({
              route: location.pathname + location.search,
              language: document.documentElement.lang,
              browserLanguage: navigator.language,
              theme: document.documentElement.dataset.theme,
              devicePixelRatio,
              innerWidth,
              innerHeight,
              outerWidth,
              outerHeight,
              scale: visualViewport.scale,
              scrollWidth: document.documentElement.scrollWidth,
              scrollHeight: document.documentElement.scrollHeight,
              tables: [...document.querySelectorAll("[appDataTable]")].map((element) => ({
                rows: element.querySelectorAll("tbody tr").length,
                width: element.clientWidth,
                scrollWidth: element.scrollWidth,
                bounds: element.getBoundingClientRect().toJSON(),
              })),
              dialogs: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].map(
                (element) => ({
                  role: element.getAttribute("role"),
                  bounds: element.getBoundingClientRect().toJSON(),
                  containsFocus: element.contains(document.activeElement),
                }),
              ),
            }));
            const snapshot = {
              name,
              state,
              fixtureState: workspace.empty ? "empty" : "local-fixtures",
              ...metrics,
              tableFocusChecks: state === "ready" ? tableFocusChecks : [],
              axe: null,
            };
            report.snapshots.push(snapshot);
            // CDP conserve le zoom natif. Une capture Playwright pleine page peut modifier le viewport.
            const { contentSize } = await protocol.send("Page.getLayoutMetrics");
            const { data } = await protocol.send("Page.captureScreenshot", {
              format: "png",
              captureBeyondViewport: true,
              clip: { ...contentSize, scale: 1 },
            });
            await writeFile(testInfo.outputPath(`${name}.png`), Buffer.from(data, "base64"));
            expect(metrics.route, name).toBe(workspace.path);
            expect(metrics.language, name).toBe(size.language);
            expect(metrics.theme, name).toBe(theme);
            expect(metrics.devicePixelRatio, name).toBe(2);
            expect(metrics.innerWidth, name).toBe(size.cssWidth);
            expect(metrics.scale, name).toBe(1);
            expect(metrics.scrollWidth, name).toBeLessThanOrEqual(metrics.innerWidth);
            expect(await zoomMetrics(), name).toEqual({
              devicePixelRatio: 2,
              innerWidth: size.cssWidth,
              scale: 1,
            });
            if (audit) {
              const result = await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze();
              snapshot.axe = {
                violations: result.violations,
                incomplete: result.incomplete.map((rule) => rule.id),
              };
              expect(result.violations, name).toEqual([]);
            }
          };
          await expect(page.locator("main h1")).toHaveCount(1);
          if (workspace.path.startsWith("/backoffice/")) {
            await expect(page.locator(".sidebar")).toBeHidden();
            await expect(page.locator(".navigation-trigger")).toBeVisible();
          }
          // Auditez chaque route en vue étroite claire et la liste de démonstration dans toute la matrice.
          await capture(
            "ready",
            (size.name === "narrow" && theme === "light") || workspace.name === "design-workflows",
          );
          const auditOverlays = size.name === "narrow" && theme === "dark";
          if (workspace.name === "design-workflows") {
            await checkDesignControls(
              page,
              designWorkspaceText[size.language],
              capture,
              auditOverlays,
            );
          }
          if (workspace.name === "quote-validation" && auditOverlays)
            await checkStackedGuard(page, capture);
          expect(report.blockedRequests).toEqual([]);
          expect(report.unexpectedApi).toEqual([]);
          expect(report.pageErrors).toEqual([]);
          expect(report.unexpectedDialogs).toEqual([]);
        }
      }
    }
    expect(report.previews).toHaveLength(sizes.length);
    report.completed = true;
  } catch (error) {
    report.failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    try {
      await context?.close();
    } finally {
      try {
        report.durationMs = Date.now() - started;
        report.withinTargetDuration = report.durationMs < report.targetDurationMs;
        const path = testInfo.outputPath("workspace-zoom-metrics.json");
        await writeFile(path, JSON.stringify(report, null, 2));
        await testInfo.attach("workspace-zoom-metrics", { path, contentType: "application/json" });
      } finally {
        await rm(profile, { recursive: true, force: true });
      }
    }
  }
}
