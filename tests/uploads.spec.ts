import { test, expect, type Page } from "@playwright/test";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
const FONT =
  "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2";
async function project(page: Page): Promise<Project> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function empty(page: Page) {
  await page.goto("/editor");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
}
async function add(page: Page, type: string) {
  await page
    .getByRole("button", { name: `Добавить: ${type}`, exact: true })
    .click();
}
async function fontLoaded(page: Page, id: string) {
  await expect
    .poll(() =>
      page.evaluate(
        (family) =>
          [...document.fonts].some(
            (face) => face.family === family && face.status === "loaded",
          ),
        `LCFont-${id}`,
      ),
    )
    .toBe(true);
}

test("text fonts install from a device, restore, export/import, remove and undo", async ({
  page,
}) => {
  await empty(page);
  await add(page, "Текст");
  await page.getByLabel("Текст", { exact: true }).fill("Custom font test");
  await page.getByLabel("Шрифт блока", { exact: true }).selectOption("georgia");
  await expect(page.locator(".block-content")).toHaveCSS(
    "font-family",
    "Georgia, serif",
  );
  await page.getByLabel("Файл шрифта", { exact: true }).setInputFiles(FONT);
  await expect(page.getByLabel("Шрифт блока", { exact: true })).toHaveValue(
    /^font:/,
  );
  await expect
    .poll(async () => (await project(page)).customFonts?.length)
    .toBe(1);
  const saved = await project(page),
    font = saved.customFonts![0];
  await fontLoaded(page, font.id);
  await page.reload();
  await fontLoaded(page, font.id);
  expect(await project(page)).toEqual(saved);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator(".block-content")).toHaveCSS(
    "font-family",
    `LCFont-${font.id}, sans-serif`,
  );
  await page
    .getByRole("link", { name: "Вернуться в редактор", exact: true })
    .click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const download = await downloading,
    stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  const archived = JSON.parse(raw.toString());
  const { assets, ...metadata } = archived;
  expect(metadata).toEqual(saved);
  expect(assets[font.dataUrl].dataUrl).toMatch(/^data:font\/woff2;base64,/);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("link-canvas.files.v1");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Файл проекта JSON").setInputFiles({
    name: "fonts.json",
    mimeType: "application/json",
    buffer: raw,
  });
  await expect(page.getByRole("alert")).toContainText("Проект импортирован.");
  await expect
    .poll(async () => (await project(page)).customFonts?.[0].dataUrl)
    .not.toBe(font.dataUrl);
  await fontLoaded(page, font.id);
  await expect
    .poll(async () => (await project(page)).customFonts?.length)
    .toBe(1);
  await page.locator("[data-block-id]").click();
  await page
    .getByRole("button", { name: `Удалить шрифт: ${font.name}`, exact: true })
    .click();
  await expect
    .poll(async () => (await project(page)).customFonts?.length)
    .toBe(0);
  expect((await project(page)).blocks[0].fontFamily).toBeUndefined();
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await fontLoaded(page, font.id);
  await expect
    .poll(async () => (await project(page)).blocks[0].fontFamily)
    .toBe(`font:${font.id}`);
});

test("device images persist in image/GIF/link/decor/video cover and page background", async ({
  page,
}) => {
  await empty(page);
  let index = 0;
  for (const type of ["Изображение", "GIF", "Ссылка", "Декор", "Видео"]) {
    await add(page, type);
    if (type === "Видео")
      await page
        .getByLabel("Ссылка на видео", { exact: true })
        .fill(new URL("/demo/transmission.webm", page.url()).href);
    const label =
      type === "Изображение"
        ? "Ссылка на изображение"
        : type === "GIF"
          ? "Ссылка на GIF"
          : type === "Видео"
            ? "Обложка видео (необязательно)"
            : "Изображение (необязательно)";
    await page
      .getByLabel(`Файл: ${label}`, { exact: true })
      .setInputFiles("public/demo/signal.gif");
    await expect
      .poll(async () => {
        const block = (await project(page)).blocks[index];
        return (
          (type === "Изображение" || type === "GIF"
            ? block?.url
            : block?.imageUrl
          )?.startsWith("asset:") ?? false
        );
      })
      .toBe(true);
    index++;
  }
  await page.getByRole("button", { name: "Страница", exact: true }).click();
  await page
    .getByLabel("Файл: Фоновое изображение", { exact: true })
    .setInputFiles("tests/fixtures/animated.gif");
  await expect
    .poll(async () =>
      (await project(page)).page.backgroundImage.startsWith("asset:"),
    )
    .toBe(true);
  const saved = await project(page);
  await page.reload();
  expect(await project(page)).toEqual(saved);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator(".block-content img")).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator(".block-content img")
        .evaluateAll((nodes) =>
          nodes.every((el) => (el as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await expect(page.locator("video")).toHaveAttribute("poster", /^blob:/);
  await page.locator("video").evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime),
    )
    .toBeGreaterThan(0);
  expect(
    await page
      .locator(".preview-page")
      .evaluate((el) =>
        getComputedStyle(el).backgroundImage.startsWith('url("blob:'),
      ),
  ).toBe(true);
});

test("original raster pictures retain resolution while unsupported image/font files leave the project unchanged", async ({
  page,
}) => {
  await empty(page);
  await add(page, "Изображение");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2200;
    canvas.height = 1200;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff3355";
    context.fillRect(0, 0, 2200, 1200);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Файл: Ссылка на изображение", { exact: true })
    .setInputFiles({
      name: "photo.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await expect
    .poll(
      async () =>
        (await project(page)).blocks[0]?.url.startsWith("asset:") ?? false,
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator(".block-content img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBe(2200);
  const saved = await project(page);
  await page
    .getByLabel("Файл: Ссылка на изображение", { exact: true })
    .setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("<script>no</script>"),
    });
  await expect(page.getByRole("alert")).toContainText("Выберите PNG");
  expect(await project(page)).toEqual(saved);
  await add(page, "Текст");
  await expect.poll(async () => (await project(page)).blocks.length).toBe(2);
  await page.getByLabel("Файл шрифта", { exact: true }).setInputFiles({
    name: "bad.woff2",
    mimeType: "font/woff2",
    buffer: Buffer.from("wOF2corrupt font"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "не смог прочитать шрифт",
  );
  expect((await project(page)).customFonts).toBeUndefined();
});

test("mobile file picker buttons upload images and fonts without randomUUID", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await empty(page);
  await page
    .getByRole("button", { name: "Открыть библиотеку", exact: true })
    .click();
  await add(page, "Изображение");
  const choosingImage = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить с устройства", exact: true })
    .click();
  await (await choosingImage).setFiles("tests/fixtures/animated.gif");
  await expect
    .poll(
      async () =>
        (await project(page)).blocks[0]?.url.startsWith("asset:") ?? false,
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Открыть библиотеку", exact: true })
    .click();
  await add(page, "Текст");
  const choosingFont = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Установить шрифт", exact: true })
    .click();
  await (await choosingFont).setFiles(FONT);
  await expect
    .poll(async () => (await project(page)).customFonts?.length)
    .toBe(1);
  await fontLoaded(page, (await project(page)).customFonts![0].id);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".block-content img")
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);
});
