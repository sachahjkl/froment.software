import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.mjs",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  reporter: "list",
  outputDir: "../../test-results/interface",
  use: {
    baseURL: "http://127.0.0.1:4300",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "mobile",
      use: { viewport: { width: 320, height: 900 }, locale: "fr-FR", colorScheme: "light" },
    },
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 1000 }, locale: "en-GB", colorScheme: "dark" },
    },
  ],
  webServer: {
    command: "pnpm --filter @froment/web start --host 127.0.0.1 --port 4300",
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    url: "http://127.0.0.1:4300",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
