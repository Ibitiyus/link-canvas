import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
async function project(page: Page): Promise<Project> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function start(page: Page, type: string) {
  await page.goto("/editor");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Добавить: ${type}`, exact: true })
    .click();
}
function wav(seconds = 65) {
  const sampleRate = 44100,
    size = sampleRate * seconds * 4;
  const file = Buffer.alloc(44 + size);
  file.write("RIFF");
  file.writeUInt32LE(36 + size, 4);
  file.write("WAVEfmt ", 8);
  file.writeUInt32LE(16, 16);
  file.writeUInt16LE(1, 20);
  file.writeUInt16LE(2, 22);
  file.writeUInt32LE(sampleRate, 24);
  file.writeUInt32LE(sampleRate * 4, 28);
  file.writeUInt16LE(4, 32);
  file.writeUInt16LE(16, 34);
  file.write("data", 36);
  file.writeUInt32LE(size, 40);
  return file;
}
async function clearFiles(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase("link-canvas.files.v1");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
  );
}

test("video files larger than 10 MB persist and really play after reload", async ({
  page,
}) => {
  await start(page, "Видео");
  const clip = Buffer.concat([
    readFileSync("public/demo/transmission.webm"),
    Buffer.alloc(11_000_000),
  ]);
  await page.getByLabel("Файл видео", { exact: true }).setInputFiles({
    name: "large.webm",
    mimeType: "video/webm",
    buffer: clip,
  });
  await expect
    .poll(async () => (await project(page)).blocks[0]?.url)
    .toMatch(/^asset:/);
  const saved = await project(page);
  expect(JSON.stringify(saved).length).toBeLessThan(4000);
  await page.reload();
  expect(await project(page)).toEqual(saved);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator("video")).toHaveAttribute("src", /^blob:/);
  await page.locator("video").evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
  });
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video: HTMLVideoElement) => video.currentTime),
    )
    .toBeGreaterThan(0);
});

test("large music file plays, seeks, changes volume, and exports/imports with the original bytes", async ({
  page,
}) => {
  test.setTimeout(60000);
  await start(page, "Музыка");
  const file = wav();
  expect(file.length).toBeGreaterThan(10_000_000);
  await page
    .getByLabel("Название трека", { exact: true })
    .fill("Моя звуковая дорожка");
  await page
    .getByLabel("Файл музыки", { exact: true })
    .setInputFiles({ name: "track.wav", mimeType: "audio/wav", buffer: file });
  await expect
    .poll(async () => (await project(page)).blocks[0]?.url)
    .toMatch(/^asset:/);
  const saved = await project(page);
  await expect(
    page.getByRole("slider", { name: "Позиция музыки", exact: true }),
  ).toHaveAttribute("max", "65");
  await page
    .getByRole("button", { name: "Воспроизвести музыку", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Приостановить музыку", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Позиция музыки", exact: true })
    .fill("30");
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeCloseTo(30, 0);
  await page
    .getByRole("slider", { name: "Громкость музыки", exact: true })
    .fill("0.25");
  expect(
    await page
      .locator("audio")
      .evaluate((audio: HTMLAudioElement) => audio.volume),
  ).toBe(0.25);
  await page.reload();
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator("audio")).toHaveAttribute("src", /^blob:/);
  await page
    .getByRole("button", { name: "Воспроизвести музыку", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("link", { name: "Вернуться в редактор", exact: true })
    .click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const backup = Buffer.concat(chunks),
    archive = JSON.parse(backup.toString());
  expect(backup.length).toBeGreaterThan(10_000_000);
  expect(
    Buffer.from(
      archive.assets[saved.blocks[0].url].dataUrl.split(",")[1],
      "base64",
    ).equals(file),
  ).toBe(true);
  await clearFiles(page);
  await page.evaluate((key) => localStorage.removeItem(key), KEY);
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Файл проекта JSON", { exact: true }).setInputFiles({
    name: "music.json",
    mimeType: "application/json",
    buffer: backup,
  });
  await expect
    .poll(async () => (await project(page)).blocks[0]?.content)
    .toBe("Моя звуковая дорожка");
  await expect(page.getByRole("alert")).toContainText("Проект импортирован.");
  await expect
    .poll(async () => (await project(page)).blocks[0]?.url)
    .not.toBe(saved.blocks[0].url);
  await page
    .getByRole("button", { name: "Воспроизвести музыку", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
});

test("music URLs load real audio and report service pages and unavailable files", async ({
  page,
}) => {
  await page.route("https://media.example.test/track.wav", (route) =>
    route.fulfill({ contentType: "audio/wav", body: wav(3) }),
  );
  await page.route("https://media.example.test/missing.mp3", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await start(page, "Музыка");
  await page
    .getByLabel("URL музыки", { exact: true })
    .fill("https://media.example.test/track.wav");
  await page
    .getByRole("button", { name: "Воспроизвести музыку", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByLabel("URL музыки", { exact: true })
    .fill("https://youtube.com/watch?v=dQw4w9WgXcQ");
  await expect(page.locator(".field-error")).toContainText("прямая ссылка");
  await expect(
    page.getByRole("button", { name: "Воспроизвести музыку", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("URL музыки", { exact: true })
    .fill("https://media.example.test/missing.mp3");
  await expect(page.locator(".audio-track-info")).toContainText(
    "Аудио недоступно",
  );
});

test("corrupt video and IndexedDB quota failures keep the previous file and show an error", async ({
  page,
}) => {
  await start(page, "Видео");
  await page
    .getByLabel("Файл видео", { exact: true })
    .setInputFiles("tests/fixtures/clip.webm");
  await expect
    .poll(async () => (await project(page)).blocks[0]?.url)
    .toMatch(/^asset:/);
  const saved = await project(page);
  await page.getByLabel("Файл видео", { exact: true }).setInputFiles({
    name: "broken.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("not a video"),
  });
  await expect(page.getByRole("alert")).toContainText("Файл повреждён");
  expect(await project(page)).toEqual(saved);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Файл видео", { exact: true })
    .setInputFiles("tests/fixtures/clip.webm");
  await expect(page.getByRole("alert")).toContainText("Недостаточно места");
  expect(await project(page)).toEqual(saved);
});

test("free decorations move beyond the grid with zero initial rotation and restore in preview", async ({
  page,
}) => {
  await start(page, "Декор");
  await expect(page.getByLabel("Поворот, °", { exact: true })).toHaveValue("0");
  const free = page.locator(".free-block");
  const origin = await page.getByTestId("canvas").boundingBox();
  const before = await free.boundingBox();
  await page.mouse.move(
    before!.x + before!.width / 2,
    before!.y + before!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(origin!.x - 30, origin!.y - 30, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await project(page)).blocks[0]?.x)
    .toBeLessThan(0);
  await expect
    .poll(async () => (await project(page)).blocks[0]?.y)
    .toBeLessThan(0);
  await page.getByLabel("X", { exact: true }).fill("950");
  await page.getByLabel("Y", { exact: true }).fill("850");
  await expect.poll(async () => (await project(page)).blocks[0]?.x).toBe(950);
  const canvas = await page.getByTestId("canvas").boundingBox(),
    outside = await free.boundingBox();
  expect(outside!.x).toBeGreaterThan(canvas!.x + canvas!.width);
  expect(outside!.y).toBeGreaterThan(canvas!.y + canvas!.height);
  await page.getByLabel("X", { exact: true }).fill("-140");
  await page.getByLabel("Y", { exact: true }).fill("-90");
  await expect.poll(async () => (await project(page)).blocks[0]?.x).toBe(-140);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await page.reload();
  expect((await project(page)).blocks[0]).toMatchObject({
    x: -140,
    y: -90,
    rotation: 0,
  });
  const previewGrid = await page.getByTestId("canvas").boundingBox(),
    previewFree = await free.boundingBox();
  expect(previewFree!.x).toBeLessThan(previewGrid!.x);
  expect(previewFree!.y).toBeLessThan(previewGrid!.y);
  expect(previewFree!.x).toBeGreaterThanOrEqual(0);
  expect(previewFree!.y).toBeGreaterThanOrEqual(0);
});

test("images larger than 10 MB keep their original bytes and dimensions", async ({
  page,
}) => {
  test.setTimeout(60000);
  await start(page, "Изображение");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2600;
    canvas.height = 1300;
    const context = canvas.getContext("2d")!,
      pixels = context.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 65536)
      crypto.getRandomValues(pixels.data.subarray(i, i + 65536));
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const bytes = Buffer.from(png, "base64");
  expect(bytes.length).toBeGreaterThan(10_000_000);
  await page
    .getByLabel("Файл: URL изображения", { exact: true })
    .setInputFiles({ name: "large.png", mimeType: "image/png", buffer: bytes });
  await expect
    .poll(async () => (await project(page)).blocks[0]?.url)
    .toMatch(/^asset:/);
  await expect
    .poll(() =>
      page
        .locator(".block-content img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(2600);
  const saved = await project(page);
  const storedSize = await page.evaluate(
    (ref) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("link-canvas.files.v1", 1);
        open.onsuccess = () => {
          const db = open.result,
            request = db
              .transaction("files")
              .objectStore("files")
              .get(ref.slice(6));
          request.onsuccess = () => {
            resolve(request.result.blob.size);
            db.close();
          };
          request.onerror = () => {
            reject(request.error);
            db.close();
          };
        };
        open.onerror = () => reject(open.error);
      }),
    saved.blocks[0].url,
  );
  expect(storedSize).toBe(bytes.length);
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator(".block-content img")
        .evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(2600);
});

test("mobile music upload and player controls fit a narrow block", async ({
  page,
}) => {
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
    .getByRole("button", { name: "Добавить: Музыка", exact: true })
    .click();
  const choosing = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить с устройства", exact: true })
    .first()
    .click();
  await (
    await choosing
  ).setFiles({ name: "mobile.wav", mimeType: "audio/wav", buffer: wav(3) });
  await expect
    .poll(async () => (await project(page)).blocks[0]?.url)
    .toMatch(/^asset:/);
  await page
    .getByRole("button", { name: "Открыть полотно", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Воспроизвести музыку", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(0);
  const volume = await page.locator(".audio-volume").boundingBox();
  const percentage = await page.locator(".audio-volume span").boundingBox();
  expect(percentage!.height).toBeLessThan(20);
  expect(percentage!.x + percentage!.width).toBeLessThanOrEqual(
    volume!.x + volume!.width + 1,
  );
  const viewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    viewportWidth,
  );
});
