import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import { groupBlocks } from "../src/model/creative";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
const fixture: Project = {
  ...emptyProject(),
  blocks: [
    {
      ...newBlock("text"),
      id: "a",
      name: "Заголовок",
      col: 0,
      row: 0,
      colSpan: 2,
      rowSpan: 2,
    },
    {
      ...newBlock("image"),
      id: "b",
      name: "Фото",
      col: 2,
      row: 0,
      colSpan: 2,
      rowSpan: 2,
    },
  ],
};
async function setup(page: Page, project = fixture) {
  await page.addInitScript(
    ({ key, project }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(project));
    },
    { key: KEY, project },
  );
  await page.goto("/editor");
  await expect(page.locator('[data-block-id="a"]')).toBeVisible();
}
async function saved(page: Page): Promise<Project> {
  // Reload finishes before the auth check and lazy editor have mounted.
  await expect(page.locator(".editor-toolbar")).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function drag(page: Page, selector: string, dx: number, dy: number) {
  const r = (await page.locator(selector).boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + dx, r.y + r.height / 2 + dy, {
    steps: 10,
  });
  await page.mouse.up();
}
async function touch(
  context: BrowserContext,
  page: Page,
  selector: string,
  dx: number,
  dy: number,
  hold = 0,
) {
  const r = (await page.locator(selector).boundingBox())!,
    p = { x: r.x + r.width / 2, y: r.y + r.height / 2 },
    cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [p],
  });
  if (hold) await page.waitForTimeout(hold);
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: p.x + (dx * i) / 8, y: p.y + (dy * i) / 8 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
test("Grid to Free preserves the rendered rectangle; free pointer resize/rotation, lock and undo work", async ({
  page,
}) => {
  await setup(page);
  await page.locator('[data-block-id="a"]').click();
  const before = (await page.locator('[data-block-id="a"]').boundingBox())!;
  await page
    .getByLabel("Режим размещения", { exact: true })
    .selectOption("free");
  const after = (await page.locator('[data-block-id="a"]').boundingBox())!;
  for (const k of ["x", "y", "width", "height"] as const)
    expect(after[k]).toBeCloseTo(before[k], 1);
  const p = await saved(page),
    s = Number(
      await page.locator(".canvas-renderer").getAttribute("data-canvas-scale"),
    );
  await drag(page, '[data-block-id="a"]', 60 * s, 45 * s);
  await expect
    .poll(async () => (await saved(page)).blocks[0].x)
    .toBeCloseTo(p.blocks[0].x + 60);
  await page.getByLabel("Сохранять пропорции", { exact: true }).check();
  const base = (await saved(page)).blocks[0];
  await drag(page, '[data-resize-edge="se"]', 50 * s, 40 * s);
  const resized = (await saved(page)).blocks[0];
  expect(resized.width / resized.height).toBeCloseTo(base.width / base.height);
  expect(resized.width).toBeGreaterThan(base.width);
  await page
    .getByLabel("Ширина, пкс", { exact: true })
    .fill(String(Math.round(resized.width * 1.1)));
  const numeric = (await saved(page)).blocks[0];
  expect(numeric.width / numeric.height).toBeCloseTo(base.width / base.height);
  await drag(page, ".rotation-handle", 55, 20);
  const rotated = (await saved(page)).blocks[0];
  expect(rotated.rotation).not.toBe(0);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  expect((await saved(page)).blocks[0].rotation).toBe(0);
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  expect((await saved(page)).blocks[0].rotation).toBeCloseTo(rotated.rotation);
  await page.getByLabel("Закрепить положение", { exact: true }).check();
  await expect(
    page.getByLabel("Режим размещения", { exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".rotation-handle")).toHaveCount(0);
  await page.getByLabel("Закрепить положение", { exact: true }).uncheck();
  await page
    .getByLabel("Режим размещения", { exact: true })
    .selectOption("grid");
  expect((await saved(page)).blocks[0].layout).toBe("grid");
  await expect(page.locator(".rotation-handle")).toHaveCount(0);
});
test("imported groups retain data but each click and Shift click chooses only one block", async ({
  page,
}) => {
  const imported = groupBlocks(fixture, ["a", "b"]);
  await setup(page, imported);
  await page.locator('[data-block-id="a"]').click();
  await expect(page.locator('[data-selection-id="a"]')).toHaveCount(1);
  await page.locator('[data-block-id="b"]').click({ modifiers: ["Shift"] });
  await expect(page.locator("[data-selection-id]")).toHaveCount(1);
  await expect(page.locator('[data-selection-id="b"]')).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Сгруппировать", exact: true }),
  ).toHaveCount(0);
  await page.locator('[data-block-id="a"]').click();
  await page.getByLabel("Текст", { exact: true }).fill("Один блок");
  const result = await saved(page);
  expect(result.groups).toEqual(imported.groups);
  expect(result.blocks[1]).toEqual(imported.blocks[1]);
});
for (const width of [320, 390, 768])
  test(`touch ${width}: free hold drag, rotation, resize and single-block duplicate`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: true,
        isMobile: true,
      }),
      page = await context.newPage();
    await setup(page, groupBlocks(fixture, ["a", "b"]));
    await page.locator('[data-block-id="a"]').tap();
    await page.waitForTimeout(650);
    const before = await saved(page),
      s = Number(
        await page
          .locator(".canvas-renderer")
          .getAttribute("data-canvas-scale"),
      );
    await touch(context, page, '[data-block-id="a"]', 40 * s, 30 * s, 450);
    await expect
      .poll(async () => (await saved(page)).blocks[0].x)
      .toBeCloseTo(before.blocks[0].x + 40);
    await touch(context, page, '[data-resize-edge="se"]', 25, 20);
    expect((await saved(page)).blocks[0].width).toBeGreaterThan(
      before.blocks[0].width,
    );
    await page.locator(".rotation-handle").scrollIntoViewIfNeeded();
    await touch(context, page, ".rotation-handle", 45, 30);
    expect((await saved(page)).blocks[0].rotation).not.toBe(0);
    await page.locator(".mobile-selection-context summary").tap();
    await page.getByRole("button", { name: "Дублировать", exact: true }).tap();
    const result = await saved(page);
    expect(result.groups).toHaveLength(1);
    expect(result.blocks).toHaveLength(3);
    expect(result.blocks[1]).toEqual(before.blocks[1]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  });

for (const route of ["/preview", "/u/creative_test"])
  test(`${route}: all eight free types and groups retain geometry and media across devices`, async ({
    page,
  }) => {
    test.skip(
      route.startsWith("/u/") && process.env.ZIN_CANVAS_E2E !== "1",
      "Public API fixture is enabled by npm run test:canvas.",
    );
    const types = [
      "text",
      "image",
      "link",
      "gif",
      "video",
      "audio",
      "qrcode",
      "decoration",
    ] as const;
    const project: Project = {
      ...emptyProject(),
      groups: [{ id: "collage", name: "Коллаж" }],
      blocks: types.map((type, i) => ({
        ...newBlock(type),
        id: String.fromCharCode(97 + i),
        layout: "free",
        name: type,
        x: (i % 2) * 340 - 20,
        y: Math.floor(i / 2) * 240,
        width: 300,
        height: 200,
        rotation: i < 2 ? 15 : i === 5 ? -10 : 0,
        layer: i,
        ...(i < 2 ? { groupId: "collage" } : {}),
        url:
          type === "image"
            ? "https://media.zin.test/photo.svg"
            : type === "gif"
              ? "https://media.zin.test/motion.gif"
              : type === "video"
                ? "https://media.zin.test/clip.webm"
                : type === "audio"
                  ? "https://media.zin.test/track.wav"
                  : "https://example.com/zin",
      })),
    };
    await page.addInitScript(
      ({ key, project }) => localStorage.setItem(key, JSON.stringify(project)),
      { key: KEY, project },
    );
    await page.route("**/rest/v1/published_pages*", (r) =>
      r.fulfill({ json: { project } }),
    );
    await page.route("https://media.zin.test/**", async (r) => {
      const { readFileSync } = await import("node:fs");
      const path = new URL(r.request().url()).pathname;
      if (path.endsWith(".webm"))
        return r.fulfill({
          contentType: "video/webm",
          body: readFileSync("tests/fixtures/clip.webm"),
        });
      if (path.endsWith(".gif"))
        return r.fulfill({
          contentType: "image/gif",
          body: readFileSync("tests/fixtures/animated.gif"),
        });
      if (path.endsWith(".wav")) {
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
        return r.fulfill({ contentType: "audio/wav", body: b });
      }
      return r.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#ff3355"/></svg>',
      });
    });
    const geometry = () =>
      page.locator(".canvas-renderer").evaluate((root) => {
        const s = Number(root.getAttribute("data-canvas-scale")),
          origin = root.querySelector(".canvas")!.getBoundingClientRect();
        return [...root.querySelectorAll("[data-block-id]")].map((el) => {
          const r = el.getBoundingClientRect();
          return [
            el.getAttribute("data-block-id"),
            (r.x - origin.x) / s,
            (r.y - origin.y) / s,
            r.width / s,
            r.height / s,
          ] as const;
        });
      });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route);
    await expect(page.locator("[data-block-id]")).toHaveCount(8);
    await page.evaluate(() => document.fonts.ready);
    const baseline = await geometry();
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const boxes = await geometry();
      for (let i = 0; i < 8; i++) {
        expect(boxes[i][0]).toBe(baseline[i][0]);
        for (let j = 1; j < 5; j++)
          expect(
            Math.abs(Number(boxes[i][j]) - Number(baseline[i][j])),
          ).toBeLessThan(0.2);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await expect(page.locator('[data-block-id="b"] img')).toBeVisible();
    await expect(page.locator("svg.qr-code")).toBeVisible();
    await page
      .getByRole("button", { name: "Воспроизвести музыку", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator("audio")
          .evaluate((el: HTMLAudioElement) => el.currentTime),
      )
      .toBeGreaterThan(0);
    await page.locator("video").evaluate(async (el: HTMLVideoElement) => {
      el.muted = true;
      await el.play();
    });
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluate((el: HTMLVideoElement) => el.currentTime),
      )
      .toBeGreaterThan(0);
    await expect(page.locator('[data-block-id="c"] a')).toHaveAttribute(
      "href",
      "https://example.com/zin",
    );
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
    ).toEqual(project);
  });
