import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { emptyProject, newBlock } from "../src/model/defaults";
const KEY = "link-canvas.project.v1";
const image =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>';
async function setup(page: Page, media = false, font = false, youtube = false) {
  const project = emptyProject();
  project.page.backgroundImage = "https://loading.zin.test/background.svg";
  project.blocks = [
    { ...newBlock("image"), url: "https://loading.zin.test/image.svg" },
  ];
  if (media)
    project.blocks.push(
      {
        ...newBlock("audio"),
        row: 2,
        url: "https://loading.zin.test/song.wav",
      },
      {
        ...newBlock("video"),
        row: 4,
        url: "https://loading.zin.test/movie.webm",
      },
      {
        ...newBlock("gif"),
        row: 6,
        url: "https://loading.zin.test/motion.gif",
      },
    );
  if (youtube)
    project.blocks.push({
      ...newBlock("video"),
      row: 2,
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
  if (font) {
    project.customFonts = [
      {
        id: "loadingfont",
        name: "Мой шрифт",
        dataUrl: "https://loading.zin.test/font.woff2",
      },
    ];
    project.blocks.push({
      ...newBlock("text"),
      row: 8,
      fontFamily: "font:loadingfont",
      content: "Мой шрифт",
    });
  }
  await page.addInitScript(
    ({ key, project }) => localStorage.setItem(key, JSON.stringify(project)),
    { key: KEY, project },
  );
  await page.route("**/rest/v1/published_pages*", (route) =>
    route.fulfill({ json: { project } }),
  );
  return project;
}
for (const route of ["/preview", "/u/loading_test"]) {
  test(`${route}: waits for every image and background, then reveals composition without zoom controls`, async ({
    page,
  }) => {
    test.skip(
      route.startsWith("/u/") && process.env.ZIN_CANVAS_E2E !== "1",
      "Run with local public API mock configuration.",
    );
    await setup(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("https://loading.zin.test/**", async (request) => {
      if (request.request().url().endsWith("background.svg")) await gate;
      await request.fulfill({ contentType: "image/svg+xml", body: image });
    });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Загружаем ваш зин…")).toBeVisible();
    await expect(page.locator(".preview-content")).toBeHidden();
    await expect(page.locator(".zin-page-pending")).toHaveAttribute(
      "inert",
      "",
    );
    release();
    await expect(page.locator(".zin-preloader")).toHaveCount(0);
    await expect(page.locator(".preview-content")).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Масштаб полотна" }),
    ).toHaveCount(0);
    const before = await page
      .locator(".canvas-renderer")
      .getAttribute("data-canvas-scale");
    await page
      .locator(".canvas-renderer")
      .dispatchEvent("zin:zoom", { detail: "in" });
    await expect(page.locator(".canvas-renderer")).toHaveAttribute(
      "data-canvas-scale",
      before!,
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  });
}
test("failed media settles loading and offers retry", async ({ page }) => {
  await setup(page);
  await page.route("https://loading.zin.test/**", (route) =>
    route.fulfill({ status: 404, body: "Missing" }),
  );
  await page.goto("/preview");
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
  await expect(page.locator(".preview-content")).toBeVisible();
  await expect(page.getByText("Часть медиа недоступна.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Повторить загрузку" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Скрыть сообщение" }).click();
  await expect(page.locator(".zin-loading-error")).toHaveCount(0);
});
test("GIF, audio and video finish initial loading without starting playback", async ({
  page,
}) => {
  await setup(page, true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://loading.zin.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(".webm")) {
      await gate;
      return route.fulfill({
        contentType: "video/webm",
        body: readFileSync("public/templates/v1/visual.webm"),
      });
    }
    if (path.endsWith(".wav"))
      return route.fulfill({
        contentType: "audio/wav",
        body: readFileSync("public/templates/v1/demo.wav"),
      });
    if (path.endsWith(".gif"))
      return route.fulfill({
        contentType: "image/gif",
        body: readFileSync("public/templates/v1/star.gif"),
      });
    return route.fulfill({ contentType: "image/svg+xml", body: image });
  });
  await page.goto("/preview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".zin-preloader")).toBeVisible();
  release();
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
  expect(
    await page
      .locator("video")
      .evaluate((v: HTMLVideoElement) => v.readyState >= 1 && v.paused),
  ).toBe(true);
  expect(
    await page
      .locator("audio")
      .evaluate((v: HTMLAudioElement) => v.readyState >= 1 && v.paused),
  ).toBe(true);
  await page.getByRole("button", { name: "Воспроизвести музыку" }).click();
  await expect(
    page.getByRole("button", { name: "Приостановить музыку" }),
  ).toBeVisible();
});
test("editor retains zoom controls and does not wait behind a page preloader", async ({
  page,
}) => {
  await setup(page);
  await page.route("https://loading.zin.test/**", (route) => route.abort());
  await page.goto("/editor");
  await expect(
    page.getByRole("group", { name: "Масштаб полотна" }),
  ).toBeVisible();
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
});

test("custom fonts are awaited before revealing the page", async ({ page }) => {
  await setup(page, false, true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://loading.zin.test/**", async (route) => {
    if (route.request().url().endsWith(".woff2")) {
      await gate;
      return route.fulfill({
        contentType: "font/woff2",
        body: readFileSync(
          "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
        ),
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    return route.fulfill({ contentType: "image/svg+xml", body: image });
  });
  await page.goto("/preview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".zin-preloader")).toBeVisible();
  release();
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      document.fonts.check('16px "LCFont-loadingfont"'),
    ),
  ).toBe(true);
});

test("slow resources remain blocked until loaded or visitor explicitly continues", async ({
  page,
}) => {
  await page.clock.install();
  await setup(page);
  await page.route("https://loading.zin.test/**", async () => {
    /* Deliberately pending network resource. */
  });
  await page.goto("/preview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".zin-preloader")).toBeVisible();
  await page.clock.fastForward(31000);
  await expect(page.locator(".zin-preloader")).toBeVisible();
  await expect(
    page.getByText("Некоторые элементы загружаются дольше обычного."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Открыть уже загруженное" }).click();
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
  await expect(page.locator(".preview-content")).toBeVisible();
});

test("YouTube iframe is awaited without requiring playback", async ({
  page,
}) => {
  await setup(page, false, false, true);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("https://loading.zin.test/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: image }),
  );
  await page.route("https://www.youtube-nocookie.com/**", async (route) => {
    await gate;
    await route.fulfill({
      contentType: "text/html",
      body: "<html><body>Видеоплеер</body></html>",
    });
  });
  await page.goto("/preview", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".zin-preloader")).toBeVisible();
  release();
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
  await expect(page.locator("iframe")).toBeVisible();
});

test("missing IndexedDB media does not leave the page loading forever", async ({
  page,
}) => {
  const project = emptyProject();
  project.blocks = [{ ...newBlock("image"), url: "asset:missing-file" }];
  await page.addInitScript(
    ({ key, project }) => localStorage.setItem(key, JSON.stringify(project)),
    { key: KEY, project },
  );
  await page.goto("/preview");
  await expect(page.locator(".zin-preloader")).toHaveCount(0);
  await expect(
    page.getByText("Файл не найден. Загрузите заново."),
  ).toBeVisible();
  await expect(page.getByText("Часть медиа недоступна.")).toBeVisible();
});
