import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { clientId } from "./fixtures.mjs";
import {
  checkColumnSort,
  checkEmptyExport,
  chooseWorkspaceFilter,
  readTableCsv,
} from "./configuration-workspace.mjs";

export async function checkTeam(page, testInfo) {
  const token = "T".repeat(43);
  const state = { members: [], invitations: [] };
  await page.route("**/api/team**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/team") return route.fulfill({ json: state });
    const body = route.request().postDataJSON();
    if (path === "/api/team/invitations") {
      const invitation = {
        id: body.requestId,
        email: body.email,
        displayName: body.displayName,
        profile: body.profile,
        createdAt: Date.now(),
        expiresAt: Date.now() + 604800000,
        acceptedAt: null,
        cancelledAt: null,
      };
      state.invitations.push(invitation);
      return route.fulfill({
        json: { invitation, url: `${new URL(page.url()).origin}/backoffice/join#${token}` },
      });
    }
    if (path === "/api/team/accept") {
      expect(body.token).toBe(token);
      const invitation = state.invitations[0];
      invitation.acceptedAt = Date.now();
      state.members.push({
        id: clientId,
        email: invitation.email,
        displayName: invitation.displayName,
        profile: invitation.profile,
        version: 1,
        disabledAt: null,
      });
      return route.fulfill({ status: 204 });
    }
    if (path === `/api/team/members/${clientId}`) {
      const member = state.members[0];
      expect(body.expectedVersion).toBe(member.version);
      member.version++;
      member.profile = body.profile;
      member.disabledAt = body.disabled ? Date.now() : null;
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/cancel")) {
      state.invitations.find((item) => path.includes(item.id)).cancelledAt = Date.now();
      return route.fulfill({ status: 204 });
    }
    throw new Error(`Unexpected team request: ${path}`);
  });
  await page.goto("/backoffice/equipe");
  await expect(page.locator("app-team")).toHaveClass(/page-container/);
  await expect(page.locator("app-team form")).toHaveCount(0);
  await expect(page.locator("app-team table")).toHaveCount(2);
  await checkEmptyExport(page, page.locator("app-team app-table-export").first());
  await chooseWorkspaceFilter(
    page,
    page.locator("app-team app-filter-menu").first(),
    /État|Status/,
    /^Actif$|^Active$/,
  );
  await chooseWorkspaceFilter(
    page,
    page.locator("app-team app-filter-menu").last(),
    /Profil/,
    /Comptable|Accountant/,
  );
  await checkColumnSort(
    page,
    page.locator("app-team table").first(),
    0,
    "descending",
    "memberSort",
    "nameDesc",
  );
  await checkColumnSort(
    page,
    page.locator("app-team table").last(),
    0,
    "ascending",
    "invitationSort",
    "nameAsc",
    "Space",
  );
  await page.locator('app-team a[href^="/backoffice/equipe/invitations/new"]').click();
  await expect(page).toHaveURL(/\/backoffice\/equipe\/invitations\/new\?/);
  expect(new URL(page.url()).searchParams.get("memberFilter")).toBe("active");
  expect(new URL(page.url()).searchParams.get("invitationFilter")).toBe("accountant");
  const editor = page.locator("app-team-invitation");
  await expect(editor).toHaveClass(/page-container/);
  await editor.locator("form input").nth(0).fill("Team accountant");
  await editor.locator("form input").nth(1).fill("accountant@example.test");
  await editor.locator("form select").selectOption("accountant");
  await editor.locator('form button[type="submit"]').click();
  await page.getByRole("alertdialog").locator("button").last().click();
  const link = editor.locator("input[readonly]");
  await expect(link).toHaveValue(new RegExp(`#${token}$`));
  const url = await link.inputValue();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole("button", { name: /conservé le lien|saved the link/ }).click();
  await editor.locator('a[href^="/backoffice/equipe"]').click();
  await expect(
    page.locator("app-team table").first().locator('th[aria-sort="descending"]'),
  ).toHaveCount(1);
  const invitationCsv = await readTableCsv(
    page,
    page.locator("app-team app-table-export").last(),
    "team-invitations.csv",
  );
  expect(invitationCsv).toContain('"accountant"');
  expect(invitationCsv).not.toContain(token);
  expect(invitationCsv).not.toContain("accountant@example.test");
  expect(invitationCsv).not.toContain("Team accountant");
  await page.goto(url);
  await expect(page).toHaveURL(/\/backoffice\/join$/);
  const introduction = await page.locator("app-team-join h1 + p").boundingBox();
  const form = await page.locator("app-team-join form").boundingBox();
  expect(form.y - introduction.y - introduction.height).toBeGreaterThanOrEqual(24);
  await page.screenshot({ path: testInfo.outputPath("team-join.png"), fullPage: true });
  for (const field of await page.locator("app-team-join input").all())
    await field.fill("invitation-password-123");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.locator('app-team-join button[type="submit"]').click();
  await expect(page.locator('app-team-join [role="status"]')).toContainText(
    /Compte créé|Account created/,
  );
  await page.goto("/backoffice/equipe");
  await page.getByRole("button", { name: /Désactiver l’accès|Disable access/ }).click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.getByRole("button", { name: /Réactiver l’accès|Enable access/ })).toBeVisible();
  await page.locator("app-team tbody select").selectOption("collaborator");
  await page.getByRole("button", { name: /Appliquer le profil|Apply profile/ }).click();
  await page.getByRole("alertdialog").locator("button").last().click();
  await expect(page.locator("app-team tbody select")).toHaveValue("collaborator");
  const memberCsv = await readTableCsv(
    page,
    page.locator("app-team app-table-export").first(),
    "team-members.csv",
  );
  expect(memberCsv).toContain('"collaborator"');
  expect(memberCsv).not.toContain(clientId);
  expect(memberCsv).not.toContain("accountant@example.test");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("team.png"), fullPage: true });
}
