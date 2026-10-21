import { chromium } from "@playwright/test";
import { mkdirSync, copyFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
});
mkdirSync("docs/screenshots", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const c = await browser.newContext({
      viewport: { width, height: 1100 },
      isMobile: width < 600,
      hasTouch: width < 600,
      reducedMotion: "reduce",
    });
    const page = await c.newPage();
    await page.goto("http://127.0.0.1:4173/templates");
    await page
      .getByRole("heading", { name: "Cybercore", exact: true })
      .waitFor();
    await page.evaluate(() => document.fonts.ready);
    // Decode lazy images before taking the complete desktop gallery screenshot.
    if (width === 1440)
      for (const image of await page.locator(".template-thumbnail").all())
        await image.scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `docs/screenshots/templates-${width === 1440 ? "desktop" : "mobile"}.png`,
      fullPage: width === 1440,
    });
    if (width === 1440) {
      await page
        .locator('[data-template-id="music-artist"]')
        .getByRole("button", { name: "Использовать", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Заменить страницу", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Сохранено", exact: true })
        .waitFor();
      await page.getByLabel("Блок: Обложка релиза", { exact: true }).click();
      await page.screenshot({ path: "docs/screenshots/template-editor.png" });
    }
    await c.close();
  }
  copyFileSync(
    "/tmp/zin-template-contact.png",
    "docs/screenshots/templates-overview.png",
  );
} finally {
  await browser.close();
}
