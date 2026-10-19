import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5173";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ executablePath });
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${baseURL}/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `docs/screenshots/home-${name}.png`,
      fullPage: true,
    });
    await page.goto(`${baseURL}/editor`, { waitUntil: "networkidle" });
    await page.locator("[data-block-id]").first().click();
    await page.screenshot({
      path: `docs/screenshots/editor-${name}.png`,
      fullPage: true,
    });
    if (name === "mobile") {
      await page
        .getByRole("button", { name: "Открыть настройки", exact: true })
        .click();
      await page.screenshot({
        path: "docs/screenshots/inspector-mobile.png",
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Открыть библиотеку", exact: true })
        .click();
      await page.screenshot({
        path: "docs/screenshots/library-mobile.png",
        fullPage: true,
      });
    }
    await page.goto(`${baseURL}/missing`, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `docs/screenshots/404-${name}.png`,
      fullPage: true,
    });
    if (errors.length) throw new Error(errors.join("\n"));
    await context.close();
  }
  console.log(
    "Captured home, editor and 404 at desktop/mobile widths, plus mobile panels.",
  );
} finally {
  await browser.close();
}
