import { test, expect, type Page } from "@playwright/test";
import jsQR from "jsqr";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
async function saved(page: Page): Promise<Project> {
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function decodeRenderedQR(page: Page) {
  const raster = await page.locator("svg.qr-code").evaluate(async (svg) => {
    const rect = svg.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute("width", String(canvas.width));
    copy.setAttribute("height", String(canvas.height));
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(copy)], {
        type: "image/svg+xml",
      }),
    );
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(
          ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        ),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  return jsQR(new Uint8ClampedArray(raster.pixels), raster.width, raster.height)
    ?.data;
}
async function start(page: Page) {
  await page.goto("/editor");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить: QR-код", exact: true })
    .click();
}

test("QR code encodes the edited URL, survives reload/JSON, and opens that URL on click and Enter", async ({
  page,
}) => {
  await start(page);
  const url =
    "https://destination.example.test/profile?from=qr&name=canvas#hello";
  await page.getByLabel("Ссылка для QR-кода", { exact: true }).fill(url);
  await expect(page.locator("svg.qr-code")).toBeVisible();
  expect(await decodeRenderedQR(page)).toBe(url);
  expect((await saved(page)).blocks[0]).toMatchObject({
    type: "qrcode",
    url,
    colSpan: 2,
    rowSpan: 2,
  });
  // Editing selects a block without navigating away.
  await page.locator("svg.qr-code").click();
  await expect(page).toHaveURL(/\/editor$/);
  await expect(
    page.getByLabel("Ссылка для QR-кода", { exact: true }),
  ).toHaveValue(url);
  await page.reload();
  expect(await decodeRenderedQR(page)).toBe(url);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const stream = await (await downloading).createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const archive = Buffer.concat(chunks);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await expect(page.locator("svg.qr-code")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Файл проекта JSON", { exact: true })
    .setInputFiles({
      name: "qr.json",
      mimeType: "application/json",
      buffer: archive,
    });
  await expect(page.getByRole("alert")).toContainText("Проект импортирован.");
  expect(await decodeRenderedQR(page)).toBe(url);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  const link = page.getByRole("link", {
    name: "Открыть ссылку: QR-код",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", url);
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(await decodeRenderedQR(page)).toBe(url);
  await page
    .context()
    .route("https://destination.example.test/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>QR destination</h1>",
      }),
    );
  for (const keyboard of [false, true]) {
    const opening = page.waitForEvent("popup");
    if (keyboard) {
      await link.focus();
      await page.keyboard.press("Enter");
    } else await link.click();
    const opened = await opening;
    await expect(opened).toHaveURL(url);
    await expect(
      opened.getByRole("heading", { name: "QR destination" }),
    ).toBeVisible();
    await opened.close();
  }
});

test("QR errors are recoverable and update/undo uses the current URL", async ({
  page,
}) => {
  await start(page);
  const field = page.getByLabel("Ссылка для QR-кода", { exact: true });
  for (const value of [
    "",
    "javascript:alert(1)",
    `https://example.com/${"я".repeat(1500)}`,
  ]) {
    await field.fill(value);
    await expect(page.locator("svg.qr-code")).toHaveCount(0);
    if (value)
      await expect(page.locator(".field-error")).toContainText(
        value.startsWith("javascript") ? "корректную" : "слишком длинная",
      );
  }
  await field.fill("https://example.com/one");
  const first = await page.locator("svg.qr-code path").getAttribute("d");
  await field.fill("https://example.com/two");
  await expect
    .poll(() => page.locator("svg.qr-code path").getAttribute("d"))
    .not.toBe(first);
  expect(await decodeRenderedQR(page)).toBe("https://example.com/two");
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(field).toHaveValue("https://example.com/one");
  expect(await decodeRenderedQR(page)).toBe("https://example.com/one");
  await field.fill("data:text/html,boom");
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator(".type-qrcode a")).toHaveCount(0);
  await expect(page.locator(".type-qrcode")).toContainText("корректную ссылку");
});

test("mobile QR scans after styling and grid resizing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть библиотеку", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить: QR-код", exact: true })
    .click();
  await page
    .getByLabel("Ссылка для QR-кода", { exact: true })
    .fill("https://example.com/mobile");
  await page.getByLabel("Цвет QR-кода", { exact: true }).fill("#172345");
  await page.getByLabel("Фон блока", { exact: true }).fill("#fff4e6");
  await page.getByLabel("Ширина, ячеек", { exact: true }).fill("4");
  await page
    .getByRole("button", { name: "Открыть полотно", exact: true })
    .click();
  expect(await decodeRenderedQR(page)).toBe("https://example.com/mobile");
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  expect(await decodeRenderedQR(page)).toBe("https://example.com/mobile");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
