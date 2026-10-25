import { chromium } from "@playwright/test";
import { mkdirSync, existsSync } from "node:fs";
const phase = process.argv[2] ?? "after";
if (!["before", "after"].includes(phase)) throw Error("Use before or after");
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
});
const directory = "docs/screenshots/raw-signal";
mkdirSync(directory, { recursive: true });
const base = process.env.RAW_CAPTURE_URL ?? "http://127.0.0.1:5190";
try {
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    for (const route of ["", "editor"]) {
      await page.goto(`${base}/${route}`);
      await page.locator(route ? ".editor-toolbar" : "h1").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${directory}/${phase}-${route || "home"}-${width}.png`,
      });
      if (phase === "after" && route === "editor" && width === 390) {
        await page
          .getByRole("button", { name: "Открыть библиотеку", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Добавить: Текст", exact: true })
          .click();
        await page.locator(".inspector").waitFor();
        await page.waitForFunction(() => {
          const selected = document
            .querySelector("[data-selection-id]")
            ?.getBoundingClientRect();
          const area = document
            .querySelector(".canvas-scroll")
            ?.getBoundingClientRect();
          const sheet = document
            .querySelector(".mobile-sheet")
            ?.getBoundingClientRect();
          return (
            selected &&
            area &&
            sheet &&
            Math.min(selected.bottom, sheet.top) -
              Math.max(selected.top, area.top) >
              0
          );
        });
        await page.screenshot({
          path: `${directory}/after-mobile-properties.png`,
        });
        await page.getByRole("button", { name: "Свернуть панель" }).click();
        for (const [name, color] of [
          ["white", "#ffffff"],
          ["black", "#000000"],
        ]) {
          await page
            .getByRole("button", { name: "Открыть настройки", exact: true })
            .click();
          await page
            .getByRole("button", {
              name: "Открыть настройки страницы",
              exact: true,
            })
            .click();
          await page.getByLabel("Фон страницы", { exact: true }).fill(color);
          await page
            .getByRole("button", { name: "Свернуть панель", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Сохранено", exact: true })
            .waitFor();
          await page.keyboard.press("Escape");
          await page.screenshot({
            path: `${directory}/after-grid-${name}.png`,
          });
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}
