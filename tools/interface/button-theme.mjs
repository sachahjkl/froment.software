import { expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

const luminance = (hex) => {
  const text = hex.slice(1);
  const digits = text.length === 3 ? [...text].map((digit) => digit.repeat(2)).join("") : text;
  const channels = [0, 2, 4]
    .map((offset) => Number.parseInt(digits.slice(offset, offset + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (left, right) => {
  const values = [luminance(left), luminance(right)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
};

export async function checkDefaultButtonTheme(page, testInfo) {
  await page.goto("/design/button");
  await page.waitForLoadState("networkidle");
  const button = page.locator(
    '[storyVariants] button[appButton][data-button-variant="default"]:not(:disabled):not([data-button-icon-only])',
  );
  await expect(button).toBeVisible();
  const originalTheme = await page.locator("html").getAttribute("data-theme");
  const measurements = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    const tokens = await button.evaluate((node) => {
      const styles = getComputedStyle(node);
      return {
        top: styles.getPropertyValue("--button-color").trim(),
        bottom: styles.getPropertyValue("--button-highlight").trim(),
        text: styles.getPropertyValue("--button-text").trim(),
        gradient: styles.backgroundImage,
      };
    });
    expect(tokens.gradient).toContain("linear-gradient");
    expect(tokens.top).toBe(theme === "dark" ? "#3b3b4b" : "#fff");
    const minimumContrast = Math.min(
      contrast(tokens.text, tokens.top),
      contrast(tokens.text, tokens.bottom),
    );
    expect(minimumContrast).toBeGreaterThanOrEqual(4.5);
    measurements.push({ theme, ...tokens, minimumContrast });
    await button.focus();
    await expect(button).toBeFocused();
    await page.screenshot({
      path: testInfo.outputPath(`default-buttons-${theme}.png`),
      fullPage: true,
    });
  }
  await writeFile(
    testInfo.outputPath("default-button-contrast.json"),
    JSON.stringify(measurements, null, 2),
  );
  await page.evaluate((value) => {
    if (value === null) delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
  }, originalTheme);
}
