import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { newBlock, emptyProject } from "../src/model/defaults";
import type { Block, BlockType, Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
const widths = [1440, 1024, 768, 390, 320];
const block = (type: BlockType, id: string, patch: Partial<Block>): Block => ({
  ...newBlock(type),
  id,
  ...patch,
});
const project: Project = {
  ...emptyProject(),
  page: {
    ...emptyProject().page,
    title: "ОДИН ZIN / ЛЮБОЕ УСТРОЙСТВО",
    maxWidth: 960,
    columns: 4,
    background: "#121216",
  },
  blocks: [
    block("text", "text", {
      content:
        "Один ZIN. Один дизайн.\nГеометрия, переносы текста и расположение элементов сохраняются на любом экране.",
      col: 0,
      row: 0,
      colSpan: 2,
      rowSpan: 2,
      fontSize: 23,
    }),
    block("image", "photo", {
      url: "https://media.zin.test/photo.svg",
      col: 2,
      row: 0,
      colSpan: 2,
      rowSpan: 2,
    }),
    block("gif", "gif", {
      url: "https://media.zin.test/motion.gif",
      col: 0,
      row: 2,
      colSpan: 1,
      rowSpan: 2,
    }),
    block("video", "video", {
      url: "https://media.zin.test/clip.webm",
      col: 1,
      row: 2,
      colSpan: 3,
      rowSpan: 2,
    }),
    block("audio", "audio", {
      url: "https://media.zin.test/track.wav",
      content: "Звук независимого интернета",
      col: 0,
      row: 4,
      colSpan: 2,
      rowSpan: 2,
    }),
    block("qrcode", "qr", {
      url: "https://example.com/zin",
      col: 2,
      row: 4,
      colSpan: 2,
      rowSpan: 2,
    }),
    block("link", "link", {
      url: "https://example.com/zin",
      content: "ОТКРЫТЬ СВОЙ ИНТЕРНЕТ ↗",
      col: 0,
      row: 6,
      colSpan: 4,
      rowSpan: 1,
    }),
    block("decoration", "sticker", {
      x: 700,
      y: 70,
      width: 120,
      height: 80,
      rotation: -15,
      content: "ZIN!",
      background: "#ff3355",
      zIndex: 4,
    }),
    block("decoration", "negative", {
      x: -75,
      y: -40,
      width: 90,
      height: 70,
      rotation: 25,
      content: "✦",
      color: "#ff3355",
    }),
    block("decoration", "bottom", {
      x: 980,
      y: 1250,
      width: 100,
      height: 60,
      rotation: 12,
      content: "КОНЕЦ",
      fontSize: 18,
      background: "#ff3355",
    }),
  ],
};
function wave() {
  const n = 44100 * 2 * 3,
    b = Buffer.alloc(44 + n);
  b.write("RIFF");
  b.writeUInt32LE(36 + n, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(44100, 24);
  b.writeUInt32LE(88200, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(n, 40);
  return b;
}
async function prepare(page: Page) {
  await page.addInitScript(
    ({ key, project }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(project));
    },
    { key: KEY, project },
  );
  await page.route("**/rest/v1/published_pages*", (route) =>
    route.fulfill({ json: { project } }),
  );
  await page.route("https://media.zin.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(".gif"))
      return route.fulfill({
        contentType: "image/gif",
        body: readFileSync("tests/fixtures/animated.gif"),
      });
    if (path.endsWith(".webm"))
      return route.fulfill({
        contentType: "video/webm",
        body: readFileSync("tests/fixtures/clip.webm"),
      });
    if (path.endsWith(".wav"))
      return route.fulfill({ contentType: "audio/wav", body: wave() });
    return route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#fa4576"/><circle cx="430" cy="100" r="65" fill="#f7edae"/><path d="M0 400L180 70L400 400L490 190L600 400" fill="#26262e"/><text x="25" y="365" fill="white" font-size="44">INDEPENDENT INTERNET</text></svg>',
    });
  });
}
async function geometry(page: Page) {
  return page.locator(".canvas-renderer").evaluate((root) => {
    const scale = Number(root.getAttribute("data-canvas-scale")),
      board = root.querySelector(".canvas")!,
      origin = board.getBoundingClientRect();
    const text = root.querySelector(".text-content")!,
      range = document.createRange();
    range.selectNodeContents(text);
    return {
      scale,
      columns: getComputedStyle(board).gridTemplateColumns.split(" ").length,
      logicalWidth: (root.querySelector(".page-surface") as HTMLElement)
        .offsetWidth,
      boxes: [...root.querySelectorAll("[data-block-id]")].map((node) => {
        const b = node.getBoundingClientRect();
        return {
          id: node.getAttribute("data-block-id"),
          x: (b.x - origin.x) / scale,
          y: (b.y - origin.y) / scale,
          w: b.width / scale,
          h: b.height / scale,
        };
      }),
      lines: [...range.getClientRects()].map((r) => ({
        width: r.width / scale,
        height: r.height / scale,
      })),
      frameWidth: (root.querySelector(".canvas-frame") as HTMLElement)
        .clientWidth,
      scrollWidth: (root.querySelector(".canvas-frame") as HTMLElement)
        .scrollWidth,
      extent: root.querySelector(".canvas-extent")!.getBoundingClientRect()
        .height,
      bottom:
        root.querySelector('[data-block-id="bottom"]')!.getBoundingClientRect()
          .bottom -
        root.querySelector(".canvas-extent")!.getBoundingClientRect().top,
    };
  });
}
for (const route of ["/editor", "/preview", "/u/scaling_test"])
  test(`${route}: fixed geometry and text across five viewports`, async ({
    page,
  }) => {
    test.skip(
      route.startsWith("/u/") && process.env.ZIN_CANVAS_E2E !== "1",
      "Use npm run test:canvas for local mocked public API configuration.",
    );
    await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route);
    await expect(page.locator("[data-block-id]")).toHaveCount(10);
    await page.evaluate(() => document.fonts.ready);
    const original = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      KEY,
    );
    const baseline = await geometry(page);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(async () => {
          const g = await geometry(page);
          return g.scrollWidth <= g.frameWidth + 1;
        })
        .toBe(true);
      const current = await geometry(page);
      expect(current.columns).toBe(4);
      expect(current.logicalWidth).toBe(960);
      expect(current.scale).toBeLessThanOrEqual(1);
      expect(current.boxes.map((b) => b.id)).toEqual(
        baseline.boxes.map((b) => b.id),
      );
      for (let i = 0; i < current.boxes.length; i++)
        for (const key of ["x", "y", "w", "h"] as const)
          expect(
            Math.abs(current.boxes[i][key] - baseline.boxes[i][key]),
          ).toBeLessThan(0.12);
      expect(current.lines.length).toBe(baseline.lines.length);
      current.lines.forEach((line, i) =>
        expect(Math.abs(line.width - baseline.lines[i].width)).toBeLessThan(
          0.12,
        ),
      );
      expect(current.bottom).toBeLessThanOrEqual(current.extent + 1);
      expect(current.extent - current.bottom).toBeLessThan(20);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      const bottom = page.locator('[data-block-id="bottom"]');
      await bottom.scrollIntoViewIfNeeded();
      await expect(bottom).toBeInViewport();
      if (route.startsWith("/u/")) {
        await expect(page.locator(".canvas-extent")).toHaveScreenshot(
          `composition-${width}.png`,
          {
            animations: "disabled",
            mask: [page.locator(".type-gif img"), page.locator("video")],
            maxDiffPixelRatio: 0.002,
          },
        );
        if (width === 1440 || width === 390) {
          mkdirSync("docs/screenshots", { recursive: true });
          await page.screenshot({
            path: `docs/screenshots/scaling-${width === 1440 ? "desktop" : "mobile"}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }
      }
    }
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
    ).toEqual(original);
  });
test("zoom scroll extents and fit reset do not modify the project", async ({
  page,
}) => {
  await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/preview");
  await expect(page.locator("[data-block-id]")).toHaveCount(10);
  const original = await page.evaluate((key) => localStorage.getItem(key), KEY),
    fit = (await geometry(page)).scale;
  for (let i = 0; i < 7; i++)
    await page
      .getByRole("button", { name: "Увеличить полотно", exact: true })
      .click();
  expect((await geometry(page)).scale).toBeGreaterThan(1);
  expect((await geometry(page)).scrollWidth).toBeGreaterThan(390);
  await page.locator('[data-block-id="bottom"]').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-block-id="bottom"]')).toBeInViewport();
  await page
    .getByRole("button", { name: "Уменьшить полотно", exact: true })
    .click();
  await page.getByRole("button", { name: "По ширине", exact: true }).click();
  expect((await geometry(page)).scale).toBeCloseTo(fit);
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    original,
  );
});
test("scaled mobile touch targets operate links, QR, video and music", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  try {
    await prepare(page);
    await page.goto("/preview");
    await expect(page.locator("[data-block-id]")).toHaveCount(10);
    await page
      .getByRole("button", { name: "Воспроизвести музыку", exact: true })
      .tap();
    await expect
      .poll(() =>
        page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
      )
      .toBeGreaterThan(0);
    const seek = page.getByLabel("Позиция музыки", { exact: true });
    const box = (await seek.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.7, box.y + box.height / 2);
    await expect
      .poll(() =>
        page.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
      )
      .toBeGreaterThan(1);
    await page.locator("video").evaluate(async (v: HTMLVideoElement) => {
      v.muted = true;
      await v.play();
    });
    await expect
      .poll(() =>
        page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
      )
      .toBeGreaterThan(0);
    await context.route("https://example.com/**", (route) =>
      route.fulfill({ body: "opened" }),
    );
    for (const id of ["link", "qr"]) {
      const opened = page.waitForEvent("popup");
      await page.locator(`[data-block-id="${id}"] a`).tap();
      const popup = await opened;
      await popup.waitForLoadState();
      expect(popup.url()).toBe("https://example.com/zin");
      await popup.close();
    }
  } finally {
    await context.close();
  }
});
test("scaled editor converts both pointer axes to logical coordinates and refreshes height", async ({
  page,
}) => {
  await prepare(page);
  await page.goto("/editor");
  await expect(page.locator("[data-block-id]")).toHaveCount(10);
  const scale = (await geometry(page)).scale,
    card = page.locator('[data-block-id="sticker"]'),
    rect = (await card.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width / 2 + 40 * scale,
    rect.y + rect.height / 2 + 30 * scale,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).blocks.find(
            (b: Block) => b.id === "sticker",
          ).x,
        KEY,
      ),
    )
    .toBeCloseTo(740, 1);
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key)!).blocks.find(
          (b: Block) => b.id === "sticker",
        ).y,
      KEY,
    ),
  ).toBeCloseTo(100, 1);
  const before = (await geometry(page)).extent;
  await page.getByLabel("Y", { exact: true }).fill("1800");
  await expect
    .poll(async () => (await geometry(page)).extent)
    .toBeGreaterThan(before);
  await page
    .getByRole("button", { name: "Отменить", exact: false })
    .first()
    .click();
});
