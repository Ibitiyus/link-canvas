import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
async function saved(page: Page): Promise<Project> {
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function reset(page: Page) {
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await expect(page.locator("[data-block-id]")).toHaveCount(0);
}
async function add(page: Page, type: string) {
  if (
    !(await page
      .getByRole("button", { name: `Добавить: ${type}`, exact: true })
      .isVisible())
  ) {
    await page
      .getByRole("button", { name: "Открыть библиотеку", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: `Добавить: ${type}`, exact: true })
    .click();
}
function noOverlap(project: Project) {
  const blocks = project.blocks.filter((b) => b.type !== "decoration");
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i],
        b = blocks[j];
      expect(
        a.col < b.col + b.colSpan &&
          a.col + a.colSpan > b.col &&
          a.row < b.row + b.rowSpan &&
          a.row + a.rowSpan > b.row,
      ).toBe(false);
    }
}
test("home, editor, demo and local preview navigation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Создать своё пространство" }).click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(page.locator("[data-block-id]")).toHaveCount(4);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page).toHaveURL(/\/preview$/);
  await expect(
    page.locator(
      ".grid-cell, .drag-handle, .resize-handle, .inspector, .library",
    ),
  ).toHaveCount(0);
  await expect(
    page.getByText("Локальный предпросмотр", { exact: false }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("real pointer dragging, resizing, collision redistribution, undo and redo", async ({
  page,
}) => {
  await page.goto("/editor");
  await reset(page);
  await add(page, "Ссылка");
  await add(page, "Ссылка");
  const before = await saved(page);
  const first = before.blocks[0],
    second = before.blocks[1];
  const firstCard = page.locator(`[data-block-id="${first.id}"]`);
  const secondCard = page.locator(`[data-block-id="${second.id}"]`);
  const origin = (await firstCard.boundingBox())!,
    target = (await secondCard.boundingBox())!;
  await firstCard.hover();
  const handle = firstCard.getByRole("button", {
    name: "Переместить: Ссылка",
    exact: true,
  });
  const rect = (await handle.boundingBox())!;
  await page.mouse.move(rect.x + 10, rect.y + 8);
  await page.mouse.down();
  await page.mouse.move(rect.x + 10 + target.x - origin.x, rect.y + 8, {
    steps: 8,
  });
  await expect(page.locator(".drop-ghost")).toBeVisible();
  await page.mouse.up();
  const moved = await saved(page);
  expect(moved.blocks[0].col).toBe(second.col);
  noOverlap(moved);
  const sizeHandle = firstCard.getByRole("button", {
    name: "Изменить размер: Ссылка",
    exact: true,
  });
  const corner = (await sizeHandle.boundingBox())!;
  await page.mouse.move(corner.x + 10, corner.y + 10);
  await page.mouse.down();
  await page.mouse.move(
    corner.x + 10 + (target.x - origin.x),
    corner.y + 10 + 128,
    { steps: 8 },
  );
  await page.mouse.up();
  const resized = await saved(page);
  expect(resized.blocks[0]).toMatchObject({ colSpan: 2, rowSpan: 2 });
  noOverlap(resized);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  expect((await saved(page)).blocks[0].colSpan).toBe(1);
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  expect((await saved(page)).blocks[0].colSpan).toBe(2);
});
test("inspector edits, page settings and reload preserve every property", async ({
  page,
}) => {
  await page.goto("/editor");
  await reset(page);
  await add(page, "Текст");
  await page
    .getByLabel("Название блока", { exact: true })
    .fill("Мой заголовок");
  await page.getByLabel("Текст", { exact: true }).fill("Сохранённый текст");
  await page.getByLabel("Размер шрифта", { exact: true }).fill("33");
  await page.getByLabel("Ширина, ячеек", { exact: true }).fill("3");
  await page.getByLabel("Высота, ячеек", { exact: true }).fill("2");
  await page.getByLabel("Фон блока", { exact: true }).fill("#123456");
  await page.getByLabel("Цвет текста", { exact: true }).fill("#fedcba");
  await page.getByLabel("Скругление", { exact: true }).fill("31");
  await page.getByLabel("Прозрачность, %", { exact: true }).fill("75");
  await page.getByLabel("Рамка, пкс", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Справа", exact: true }).click();
  await page.getByRole("button", { name: "Страница", exact: true }).click();
  await page.getByLabel("Колонки", { exact: true }).selectOption("3");
  await page
    .getByLabel("Название страницы", { exact: true })
    .fill("Моя страница");
  await page.getByLabel("Расстояние между блоками", { exact: true }).fill("22");
  await page
    .getByLabel("Основной шрифт", { exact: true })
    .selectOption("serif");
  const project = await saved(page);
  expect(project.blocks[0]).toMatchObject({
    content: "Сохранённый текст",
    fontSize: 33,
    colSpan: 3,
    rowSpan: 2,
    background: "#123456",
    color: "#fedcba",
    radius: 31,
    opacity: 0.75,
    borderWidth: 2,
    align: "right",
  });
  expect(project.page).toMatchObject({ columns: 3, gap: 22, font: "serif" });
  await page.reload();
  expect(await saved(page)).toEqual(project);
  await expect(page.locator(".text-content")).toHaveText("Сохранённый текст");
});
test("layers duplicate/delete and reorder free decorations; drag changes coordinates", async ({
  page,
}) => {
  await page.goto("/editor");
  await reset(page);
  await add(page, "Декор");
  await page.getByLabel("Поворот, °", { exact: true }).fill("0");
  await page.getByLabel("Название блока", { exact: true }).fill("Звезда");
  await page
    .getByRole("button", { name: "Дублировать блок", exact: true })
    .click();
  await page.getByLabel("Название блока", { exact: true }).fill("Смайл");
  await page.getByLabel("Эмодзи или символ", { exact: true }).fill("🙂");
  const original = await saved(page);
  await page.getByRole("button", { name: /Слои/ }).click();
  await page.getByRole("button", { name: "Ниже: Смайл", exact: true }).click();
  const reordered = await saved(page);
  expect(reordered.blocks.find((b) => b.name === "Смайл")!.zIndex).toBeLessThan(
    reordered.blocks.find((b) => b.name === "Звезда")!.zIndex,
  );
  const star = reordered.blocks.find((b) => b.name === "Звезда")!;
  const card = page.locator(`[data-block-id="${star.id}"]`);
  const bounds = (await card.boundingBox())!;
  await page.mouse.move(bounds.x + 50, bounds.y + 50);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 120, bounds.y + 120, { steps: 8 });
  await page.mouse.up();
  const moved = await saved(page);
  expect(moved.blocks.find((b) => b.id === star.id)!.x).toBeGreaterThan(star.x);
  expect(moved.blocks.find((b) => b.id === star.id)!.y).toBeGreaterThan(star.y);
  await page
    .getByRole("button", { name: "Удалить: Смайл", exact: true })
    .click();
  expect((await saved(page)).blocks).toHaveLength(original.blocks.length - 1);
  await page.reload();
  expect((await saved(page)).blocks).toHaveLength(1);
});
test("JSON export/import round-trip and invalid files show errors", async ({
  page,
}) => {
  await page.goto("/editor");
  const project = await saved(page);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("zin.json");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual(project);
  await reset(page);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Файл проекта JSON").setInputFiles({
    name: "project.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(project)),
  });
  expect(await saved(page)).toEqual(project);
  await page.getByLabel("Файл проекта JSON").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось прочитать JSON",
  );
  expect(await saved(page)).toEqual(project);
});
test("reset requires confirmation and can be undone", async ({ page }) => {
  await page.goto("/editor");
  await saved(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await expect(page.locator("[data-block-id]")).toHaveCount(4);
  await reset(page);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(page.locator("[data-block-id]")).toHaveCount(4);
});
test("media URLs render images/GIF, safe YouTube embed, direct video and real links", async ({
  page,
}) => {
  // Deterministic HTTP fixtures validate media loading without relying on a third party.
  const gif = readFileSync("tests/fixtures/animated.gif");
  const clip = readFileSync("tests/fixtures/clip.webm");
  await page.route("https://media.example.test/**", (route) =>
    route.fulfill(
      route.request().url().endsWith(".webm")
        ? { contentType: "video/webm", body: clip }
        : { contentType: "image/gif", body: gif },
    ),
  );
  await page.route("https://www.youtube-nocookie.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>YouTube embed fixture</h1>",
    }),
  );
  await page
    .context()
    .route("https://example.com/destination", (route) =>
      route.fulfill({ contentType: "text/html", body: "<h1>Destination</h1>" }),
    );
  await page.goto("/editor");
  await reset(page);
  await add(page, "Изображение");
  await page
    .getByLabel("Ссылка на изображение", { exact: true })
    .fill("https://media.example.test/image.gif");
  await add(page, "GIF");
  await page
    .getByLabel("Ссылка на GIF", { exact: true })
    .fill("https://media.example.test/animated.gif");
  await add(page, "Видео");
  await page
    .getByLabel("Ссылка на видео", { exact: true })
    .fill("https://youtu.be/dQw4w9WgXcQ");
  await add(page, "Видео");
  await page.getByLabel("Название блока", { exact: true }).fill("Файл");
  await page
    .getByLabel("Ссылка на видео", { exact: true })
    .fill("https://media.example.test/clip.webm");
  await expect(page.locator("video")).toHaveAttribute(
    "src",
    "https://media.example.test/clip.webm",
  );
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.readyState),
    )
    .toBeGreaterThanOrEqual(1);
  await page
    .getByLabel("Ссылка на видео", { exact: true })
    .fill("https://example.com/unsupported");
  await expect(
    page.getByText("Эта ссылка на видео не поддерживается."),
  ).toBeVisible();
  await page
    .getByLabel("Ссылка на видео", { exact: true })
    .fill("https://media.example.test/clip.webm");
  await add(page, "Ссылка");
  await page
    .getByLabel("Текст кнопки", { exact: true })
    .fill("Открыть назначение");
  await page
    .getByLabel("Ссылка для перехода", { exact: true })
    .fill("https://example.com/destination");
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  const images = page.locator(".block-content img");
  await expect(images).toHaveCount(2);
  expect(
    await images.evaluateAll((nodes) =>
      nodes.every(
        (node) =>
          (node as HTMLImageElement).complete &&
          (node as HTMLImageElement).naturalWidth > 0,
      ),
    ),
  ).toBe(true);
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  await page.locator("video").evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime),
    )
    .toBeGreaterThan(0);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Открыть назначение" }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole("heading")).toHaveText("Destination");
  await popup.close();
});
test("corrupted storage is reported and preserved until an explicit change", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{broken"), KEY);
  await page.goto("/editor");
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось восстановить",
  );
  await page.waitForTimeout(500);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    "{broken",
  );
  await add(page, "Текст");
  expect((await saved(page)).blocks).toHaveLength(5);
});
test("storage quota failure is visible and JSON export remains available", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.goto("/editor");
  await expect(
    page.getByRole("button", { name: "Ошибка сохранения", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Не удалось сохранить");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  await downloading;
});
test("mobile layout and touch dragging are usable without horizontal overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto("/editor");
  await reset(page);
  await add(page, "Текст");
  await page.getByLabel("Текст", { exact: true }).fill("Мобильный текст");
  await saved(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Открыть полотно", exact: true })
    .click();
  const handle = page.getByRole("button", {
    name: "Переместить: Текст",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const bounds = (await handle.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const point = { x: bounds.x + 10, y: bounds.y + 8 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, y: point.y + 128 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  // CDP may acknowledge touchEnd before React commits and starts the save timer.
  await expect
    .poll(
      async () =>
        (
          await page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!),
            KEY,
          )
        ).blocks[0].row,
    )
    .toBe(1);
  await saved(page);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator(".text-content")).toHaveText("Мобильный текст");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("column presets 3/4/5 reflow dense content and keep inspector placement valid", async ({
  page,
}) => {
  await page.goto("/editor");
  for (let i = 0; i < 6; i++) await add(page, "Ссылка");
  await page.getByRole("button", { name: "Страница", exact: true }).click();
  for (const columns of [3, 5, 4]) {
    await page
      .getByLabel("Колонки", { exact: true })
      .selectOption(String(columns));
    const project = await saved(page);
    expect(project.page.columns).toBe(columns);
    noOverlap(project);
    expect(project.blocks.every((b) => b.col + b.colSpan <= columns)).toBe(
      true,
    );
  }
});
test("Escape cancels a pointer drag and keyboard shortcuts modify real history", async ({
  page,
}) => {
  await page.goto("/editor");
  await reset(page);
  await add(page, "Ссылка");
  const before = await saved(page);
  const handle = page.getByRole("button", {
    name: "Переместить: Ссылка",
    exact: true,
  });
  await handle.hover();
  const rect = (await handle.boundingBox())!;
  await page.mouse.move(rect.x + 10, rect.y + 8);
  await page.mouse.down();
  await page.mouse.move(rect.x + 10, rect.y + 140);
  await expect(page.locator(".drop-ghost")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".drop-ghost")).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await page.locator("[data-block-id]").click();
  await page.keyboard.press("Control+d");
  await expect(page.locator("[data-block-id]")).toHaveCount(2);
  await page.keyboard.press("Control+z");
  await expect(page.locator("[data-block-id]")).toHaveCount(1);
  await page.keyboard.press("Control+Shift+z");
  await expect(page.locator("[data-block-id]")).toHaveCount(2);
});
