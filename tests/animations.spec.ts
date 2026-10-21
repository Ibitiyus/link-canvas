import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import {
  ANIMATIONS,
  DEFAULT_ANIMATION,
  DEFAULT_VISUAL,
} from "../src/model/effects";
import { groupBlocks } from "../src/model/creative";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
const fx = {
  animation: { ...DEFAULT_ANIMATION, type: "float" as const },
  hover: "scale" as const,
  visual: { ...DEFAULT_VISUAL, glow: 3 },
};
const fixture: Project = {
  ...emptyProject(),
  blocks: [
    {
      ...newBlock("text"),
      id: "a",
      name: "Тест",
      colSpan: 2,
      rowSpan: 2,
      effects: fx,
    },
    {
      ...newBlock("image"),
      id: "b",
      name: "Фото",
      layout: "free",
      x: 460,
      y: 40,
      width: 200,
      height: 200,
      rotation: 35,
      effects: fx,
    },
  ],
};
async function setup(page: Page, p = fixture, route = "/editor") {
  await page.addInitScript(
    ({ p, key }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(p));
    },
    { p, key: KEY },
  );
  await page.route("**/rest/v1/published_pages*", (r) =>
    r.fulfill({ json: [{ username: "animation_test", project: p }] }),
  );
  await page.goto(route);
  await expect(page.locator('[data-block-id="a"]')).toBeVisible();
}
const outer = (page: Page) => page.locator('[data-block-id="a"]');
const anim = (page: Page) => outer(page).locator(".effect-animation").first();
async function stored(page: Page) {
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function drag(page: Page) {
  const b = (await outer(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 140, {
    steps: 10,
  });
  await expect(anim(page)).toHaveCSS("animation-name", "none");
  await page.mouse.up();
}
test("grid animation controls, temporary preview, undo, JSON and drag preserve geometry", async ({
  page,
}, testInfo) => {
  await setup(page);
  await expect(anim(page)).toHaveCSS("animation-name", "none");
  await outer(page).click();
  await page.getByText("Анимация и эффекты", { exact: true }).click();
  await page.getByLabel("Тип анимации", { exact: true }).selectOption("pulse");
  await expect(page.getByLabel("Тип анимации", { exact: true })).toHaveValue(
    "pulse",
  );
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(page.getByLabel("Тип анимации", { exact: true })).toHaveValue(
    "float",
  );
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  const b = await outer(page).boundingBox();
  const originalContent = await outer(page)
    .locator(".block-content")
    .elementHandle();
  await page
    .getByRole("button", { name: "Воспроизвести анимацию", exact: true })
    .click();
  await expect(anim(page)).toHaveCSS("animation-name", "zin-pulse");
  expect(await originalContent!.evaluate((e) => e.isConnected)).toBe(true);
  expect(await outer(page).boundingBox()).toEqual(b);
  await page
    .getByLabel("Показывать анимации в редакторе", { exact: true })
    .check();
  await drag(page);
  const moved = await stored(page);
  expect(moved.blocks[0].row).toBeGreaterThan(0);
  expect(moved.blocks[1].rotation).toBe(35);
  await expect(anim(page)).toHaveCSS("animation-name", "zin-pulse");
  await page
    .getByLabel("Показывать анимации в редакторе", { exact: true })
    .uncheck();
  await drag(page);
  await stored(page);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const file = await download;
  expect(await file.failure()).toBeNull();
  const backup = testInfo.outputPath("animated.json");
  await file.saveAs(backup);
  const exported = JSON.parse(readFileSync(backup, "utf8"));
  expect(exported.blocks[0].effects.animation.type).toBe("pulse");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("Файл проекта JSON", { exact: true })
    .setInputFiles(backup);
  await expect(outer(page)).toBeVisible();
  expect((await stored(page)).blocks[0].effects).toEqual(
    exported.blocks[0].effects,
  );
  await page.reload();
  await expect(anim(page)).toHaveCSS("animation-name", "none");
  await outer(page).click();
  await page.getByText("Анимация и эффекты", { exact: true }).click();
  await expect(page.getByLabel("Тип анимации", { exact: true })).toHaveValue(
    "pulse",
  );
});
for (const route of ["/preview", "/u/animation_test"])
  test(`${route}: animation wrappers preserve geometry, author rotation and reduced motion`, async ({
    page,
  }) => {
    test.skip(
      route.startsWith("/u/") && process.env.ZIN_CANVAS_E2E !== "1",
      "Public fixture requires test:canvas configuration",
    );
    await setup(page, fixture, route);
    await expect(anim(page)).toHaveCSS("animation-name", "zin-float");
    const before = await page.locator(".canvas-extent").boundingBox();
    const free = page.locator('[data-block-id="b"]');
    await expect(free).toHaveCSS("transform", /matrix\(/);
    const transform = await free.evaluate((e) => getComputedStyle(e).transform);
    await page.waitForTimeout(300);
    expect(await page.locator(".canvas-extent").boundingBox()).toEqual(before);
    expect(await free.evaluate((e) => getComputedStyle(e).transform)).toBe(
      transform,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(anim(page)).toHaveCSS("animation-name", "none");
    await expect(anim(page)).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
    ).toEqual(fixture);
  });
test("group animation rotates around a common center, not individual member centers", async ({
  page,
}) => {
  const p = groupBlocks(fixture, ["a", "b"]);
  p.groups![0].effects = {
    animation: { ...DEFAULT_ANIMATION, type: "spin", duration: 4 },
  };
  await setup(page, p, "/preview");
  const group = page.locator(".effect-group"),
    motion = group.locator(".effect-animation").first();
  await expect(motion).toHaveCSS("animation-name", "zin-spin");
  await motion.evaluate((e) => {
    for (const a of e.getAnimations()) {
      a.pause();
      a.currentTime = 1000;
    }
  });
  await expect(motion).toHaveCSS("transform", /matrix\(0, 1, -1, 0,/);
  expect(
    await page
      .locator(".canvas-frame")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBe(true);
  expect(
    await outer(page).evaluate((e) => getComputedStyle(e).left),
  ).toBeTruthy();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
  ).toEqual(p);
});
test("mobile bottom sheet exposes animation controls and does not emulate hover", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await setup(page);
  await page.getByRole("button", { name: "Открыть слои", exact: true }).tap();
  await page.getByRole("button", { name: /^\d+ Тест$/ }).tap();
  await page
    .getByRole("button", { name: "Открыть настройки", exact: true })
    .tap();
  await page.getByText("Анимация и эффекты", { exact: true }).tap();
  await page.getByLabel("Тип анимации", { exact: true }).selectOption("sway");
  await stored(page);
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .tap();
  await outer(page).tap();
  await expect(outer(page).locator(".effect-hover")).toHaveCSS(
    "transform",
    "none",
  );
  expect(await page.locator(".canvas-scroll").isVisible()).toBe(true);
  await context.close();
});
test("offscreen and hidden tabs pause CSS timelines; hover and filters stay independent", async ({
  page,
}) => {
  await setup(page, fixture, "/preview");
  const motion = anim(page),
    hover = outer(page).locator(".effect-hover");
  await expect(motion).toHaveCSS("animation-play-state", "running");
  await outer(page).hover();
  await expect(hover).not.toHaveCSS("transform", "none");
  await expect(outer(page).locator(".effect-visual")).toHaveCSS(
    "filter",
    /drop-shadow/,
  );
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(motion).toHaveCSS("animation-play-state", "paused");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    document
      .querySelector(".preview-page")
      ?.setAttribute("style", "padding-top:2000px");
  });
  // Move the logical canvas below the viewport without changing the saved project.
  await page
    .locator(".canvas-renderer")
    .evaluate((e) => ((e as HTMLElement).style.marginTop = "2000px"));
  await expect(motion).toHaveCSS("animation-play-state", "paused");
  await outer(page).scrollIntoViewIfNeeded();
  await expect(motion).toHaveCSS("animation-play-state", "running");
});
test("animated rotated free blocks stop moving during pointer manipulation and keep author geometry", async ({
  page,
}) => {
  await setup(page);
  await page.locator('[data-block-id="b"]').click();
  await page.getByText("Анимация и эффекты", { exact: true }).click();
  await page
    .getByLabel("Показывать анимации в редакторе", { exact: true })
    .check();
  const block = page.locator('[data-block-id="b"]'),
    motion = block.locator(".effect-animation");
  await expect(motion).toHaveCSS("animation-name", "zin-float");
  const before = await stored(page),
    r = (await block.boundingBox())!,
    scale = Number(
      await page.locator(".canvas-renderer").getAttribute("data-canvas-scale"),
    );
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 30, r.y + r.height / 2 + 20, {
    steps: 8,
  });
  await expect(motion).toHaveCSS("animation-name", "none");
  await page.mouse.up();
  const after = await stored(page);
  expect(after.blocks[1].x).toBeCloseTo(before.blocks[1].x + 30 / scale);
  expect(after.blocks[1].rotation).toBe(35);
  await expect(motion).toHaveCSS("animation-name", "zin-float");
});
test("all block types animate while media, links and transparent backgrounds remain usable", async ({
  page,
}) => {
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
  const p: Project = {
    ...emptyProject(),
    blocks: types.map((type, i) => ({
      ...newBlock(type),
      id: i === 0 ? "a" : `media-${type}`,
      layout: "free",
      x: (i % 2) * 350,
      y: Math.floor(i / 2) * 220,
      width: 300,
      height: 200,
      background: "#22334480",
      effects: fx,
      url:
        type === "video"
          ? "https://fx.zin.test/clip.webm"
          : type === "audio"
            ? "https://fx.zin.test/audio.wav"
            : type === "image" || type === "gif"
              ? "https://fx.zin.test/image.svg"
              : "https://example.com",
    })),
  };
  await page.route("https://fx.zin.test/**", (r) => {
    const url = r.request().url();
    if (url.endsWith("webm"))
      return r.fulfill({
        contentType: "video/webm",
        body: readFileSync("tests/fixtures/clip.webm"),
      });
    if (url.endsWith("wav")) {
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
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="pink"/></svg>',
    });
  });
  await setup(page, p, "/preview");
  await expect(page.locator(".anim-float")).toHaveCount(8);
  await expect(outer(page).locator(".block-content")).toHaveCSS(
    "background-color",
    "rgba(34, 51, 68, 0.5)",
  );
  await expect(page.locator('[data-block-id="media-link"] a')).toHaveAttribute(
    "href",
    "https://example.com/",
  );
  await expect(page.locator("svg.qr-code")).toBeVisible();
  await page.locator('[data-block-id="media-audio"]').scrollIntoViewIfNeeded();
  const play = (await page
    .getByRole("button", { name: "Воспроизвести музыку", exact: true })
    .boundingBox())!;
  await page.mouse.click(play.x + play.width / 2, play.y + play.height / 2);
  await expect
    .poll(() =>
      page.locator("audio").evaluate((e: HTMLAudioElement) => e.currentTime),
    )
    .toBeGreaterThan(0);
  await page.locator("video").evaluate((e: HTMLVideoElement) => e.play());
  await expect
    .poll(() =>
      page.locator("video").evaluate((e: HTMLVideoElement) => e.currentTime),
    )
    .toBeGreaterThan(0);
});
test("every configured effect produces a CSS timeline with bounded flicker speed", async ({
  page,
}) => {
  const types = Object.keys(ANIMATIONS).filter(
    (k) => k !== "none",
  ) as (keyof typeof ANIMATIONS)[];
  const p: Project = {
    ...emptyProject(),
    blocks: types.map((type, i) => ({
      ...newBlock("text"),
      id: i === 0 ? "a" : `fx-${i}`,
      col: i % 4,
      row: Math.floor(i / 4),
      effects: {
        animation: {
          ...DEFAULT_ANIMATION,
          type,
          duration: 0.8,
          intensity: 0.7,
          delay: 0.2,
          repeat: "once",
          direction: "reverse",
        },
      },
    })),
  };
  await setup(page, p, "/preview");
  for (const type of types) {
    const motion = page.locator(`.anim-${type}`);
    await expect(motion).toHaveCSS("animation-name", `zin-${type}`);
    await expect(motion).toHaveCSS(
      "animation-duration",
      ["flicker", "glitch"].includes(type) ? "2s" : "0.8s",
    );
    await expect(motion).toHaveCSS("animation-direction", "reverse");
    expect(await motion.evaluate((e) => e.getAnimations().length)).toBe(1);
  }
});
