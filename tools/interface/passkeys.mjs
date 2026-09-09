import { expect } from "@playwright/test";
import { randomBytes } from "node:crypto";

export async function checkPasskeys(page, testInfo) {
  const session = await page.context().newCDPSession(page);
  await session.send("WebAuthn.enable");
  const { authenticatorId } = await session.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  let keys = [];
  let registration;
  let assertion;
  const routes = /\/api\/auth\/passkeys(?:\/|$)/;
  await page.route(routes, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/register/options"))
      return route.fulfill({
        json: {
          rp: { id: "localhost", name: "Froment Software" },
          user: {
            id: Buffer.from("01ARZ3NDEKTSV4RRFFQ69G5FAV").toString("base64url"),
            name: "test@example.test",
            displayName: "Test",
          },
          challenge: randomBytes(32).toString("base64url"),
          timeout: 60000,
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          excludeCredentials: [],
          attestation: "none",
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
        },
      });
    if (path.endsWith("/register/verify")) {
      registration = route.request().postDataJSON();
      keys = [
        {
          id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
          name: "Laptop",
          createdAt: Date.now(),
          lastUsedAt: null,
        },
      ];
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/login/options"))
      return route.fulfill({
        json: {
          challenge: randomBytes(32).toString("base64url"),
          rpId: "localhost",
          timeout: 60000,
          userVerification: "required",
        },
      });
    if (path.endsWith("/login/verify")) {
      assertion = route.request().postDataJSON();
      return route.fulfill({ json: { mode: "administrator", expiresAt: Date.now() + 900000 } });
    }
    if (path.endsWith("/remove")) {
      keys = [];
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: keys });
  });
  try {
    await page.goto(page.url().replace("127.0.0.1", "localhost"));
    const panel = page.locator("app-account-passkeys");
    await panel.getByLabel(/Nom de la clé|Passkey name/).fill("Laptop");
    await panel.getByLabel(/Mot de passe actuel|Current password/).fill("administrator-password");
    await panel.getByRole("button", { name: /Ajouter une clé|Add a passkey/ }).click();
    await expect(panel.getByText("Laptop", { exact: true })).toBeVisible();
    expect(registration.response.attestationObject).toBeTruthy();
    expect(registration.response.clientDataJSON).toBeTruthy();
    await page.goto("http://localhost:4300/backoffice/login");
    await page
      .getByRole("button", { name: /Se connecter avec une clé|Sign in with a passkey/ })
      .click();
    await expect(page).toHaveURL(/\/backoffice\/dashboard$/);
    expect(assertion.id).toBe(registration.id);
    expect(assertion.response.signature).toBeTruthy();
    const navigation = page.locator(".navigation-trigger");
    await expect(page.locator(".workspace-header")).toBeVisible();
    if (await navigation.isVisible()) await navigation.click();
    await page.locator(".account summary:visible").click();
    await page.getByRole("link", { name: /Sécurité du compte|Account security/ }).click();
    await panel.getByLabel(/Mot de passe actuel|Current password/).fill("administrator-password");
    await panel.getByRole("button", { name: /Retirer Laptop|Remove Laptop/ }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Confirmer|Confirm/ })
      .click();
    await expect(panel.getByText("Laptop", { exact: true })).toHaveCount(0);
    await expect(panel.getByRole("status")).toContainText(/Clé retirée|Passkey removed/);
    await page.screenshot({ path: testInfo.outputPath("passkeys.png"), fullPage: true });
  } finally {
    if (!page.isClosed()) {
      await session.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
      await session.detach();
      await page.unroute(routes);
    }
  }
}
