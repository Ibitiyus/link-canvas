import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import { orderedLayers } from "../src/model/layers";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
const fixture: Project = {
  ...emptyProject(),
  blocks: [
    {
      ...newBlock("text"),
      id: "text",
      name: "Текст",
      content: "Прямая работа с композицией",
      col: 1,
      row: 1,
      colSpan: 2,
      rowSpan: 2,
      background: "#22334480",
    },
    {
      ...newBlock("link"),
      id: "link",
      name: "Ссылка",
      col: 0,
      row: 4,
      colSpan: 2,
      url: "https://example.com",
    },
    {
      ...newBlock("decoration"),
      id: "decor",
      name: "Рамка",
      x: 200,
      y: 140,
      width: 240,
      height: 160,
      rotation: 25,
      content: "✦",
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
  await expect(page.locator('[data-block-id="text"]')).toBeVisible();
}
async function saved(page: Page): Promise<Project> {
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
async function scale(page: Page) {
  return Number(
    await page
      .locator(".workspace .canvas-renderer")
      .getAttribute("data-canvas-scale"),
  );
}
async function touch(
  context: BrowserContext,
  page: Page,
  selector: string,
  dx: number,
  dy: number,
  hold = 0,
) {
  const box = (await page.locator(selector).boundingBox())!,
    point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [point],
  });
  if (hold) await page.waitForTimeout(hold);
  for (let i = 1; i <= 8; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x + (dx * i) / 8, y: point.y + (dy * i) / 8 }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}
test("surface drag commits once; Escape cancels the next gesture", async ({
  page,
}) => {
  // No overlapping decor at the drag start.
  await setup(page, {
    ...fixture,
    blocks: fixture.blocks.filter((b) => b.type !== "decoration"),
  });
  const s = await scale(page);
  await drag(page, '[data-block-id="text"]', 0, 128 * s);
  await expect.poll(async () => (await saved(page)).blocks[0].row).toBe(2);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  expect((await saved(page)).blocks[0].row).toBe(1);
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  expect((await saved(page)).blocks[0].row).toBe(2);
  const box = (await page.locator('[data-block-id="text"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2,
    box.y + box.height / 2 + 128 * s,
  );
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect((await saved(page)).blocks[0].row).toBe(2);
});
for (const edge of ["n", "ne", "e", "se", "s", "sw", "w", "nw"])
  test(`resize ${edge} is a real snapped gesture`, async ({ page }) => {
    await setup(page, { ...fixture, blocks: [fixture.blocks[0]] });
    await page.locator('[data-block-id="text"]').click();
    const s = await scale(page),
      unit =
        (fixture.page.maxWidth - 40 + fixture.page.gap) / fixture.page.columns;
    const dx = edge.includes("e")
        ? unit * s
        : edge.includes("w")
          ? -unit * s
          : 0,
      dy = edge.includes("s") ? 128 * s : edge.includes("n") ? -128 * s : 0;
    const selector = `[data-resize-edge="${edge}"]`;
    const r = (await page.locator(selector).boundingBox())!;
    expect(r.width).toBeGreaterThanOrEqual(43.9);
    expect(r.height).toBeGreaterThanOrEqual(43.9);
    await drag(page, selector, dx, dy);
    const next = (await saved(page)).blocks[0];
    expect(next.colSpan).toBe(edge.includes("e") || edge.includes("w") ? 3 : 2);
    expect(next.rowSpan).toBe(edge.includes("n") || edge.includes("s") ? 3 : 2);
    await page.getByRole("button", { name: "Отменить", exact: true }).click();
    expect((await saved(page)).blocks[0]).toEqual(fixture.blocks[0]);
  });
test("locks protect geometry and column changes; duplicate is unlocked and layers select hidden blocks", async ({
  page,
}) => {
  await setup(page, {
    ...fixture,
    blocks: [
      { ...fixture.blocks[0], col: 2, locked: true },
      { ...fixture.blocks[2], locked: true },
    ],
  });
  await page.getByRole("button", { name: /^Слои/ }).click();
  await page.locator('[data-layer-id="text"] .layer-select').click();
  await expect(
    page.getByLabel("Ширина, ячеек", { exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Текст", { exact: true }).fill("Содержимое доступно");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Delete");
  expect((await saved(page)).blocks).toHaveLength(2);
  await drag(page, '[data-block-id="text"]', 20, 100);
  expect((await saved(page)).blocks[0]).toMatchObject({
    col: 2,
    row: 1,
    locked: true,
  });
  await page
    .getByRole("button", { name: "Дублировать: Текст", exact: true })
    .click();
  const copy = (await saved(page)).blocks.find(
    (b) => b.name === "Текст — копия",
  )!;
  expect(copy.locked).toBe(false);
  await page.getByRole("button", { name: "Страница", exact: true }).click();
  await page.getByLabel("Колонки", { exact: true }).selectOption("3");
  await expect(page.getByRole("alert")).toContainText("Сначала разблокируйте");
  expect((await saved(page)).page.columns).toBe(4);

  await page
    .getByRole("button", { name: "Скрыть: Рамка", exact: true })
    .click();
  await page.locator('[data-layer-id="decor"] .layer-select').click();
  await expect(
    page.locator('[data-selection-id="decor"] .selection-unlock'),
  ).toBeVisible();
  await expect(page.getByLabel("Поворот, °", { exact: true })).toBeDisabled();
  await page.locator('[data-selection-id="decor"] .selection-unlock').click();
  await expect(
    page.locator('[data-selection-id="decor"] [data-resize-edge]'),
  ).toHaveCount(8);
  await page
    .getByRole("button", { name: "На задний план: Рамка", exact: true })
    .click();
  await page.reload();
  const p = await saved(page);
  expect(orderedLayers(p.blocks)[0].id).toBe("decor");
  expect(p.blocks.find((b) => b.id === "decor")).toMatchObject({
    hidden: true,
    locked: false,
  });
  expect(p.blocks[0].background).toBe("#22334480");
});
test("rotated decor moves in logical coordinates and resizes without changing rotation", async ({
  page,
}) => {
  await setup(page);
  const s = await scale(page);
  await drag(page, '[data-block-id="decor"]', 50 * s, 60 * s);
  const moved = (await saved(page)).blocks.find((b) => b.id === "decor")!;
  expect(moved.x).toBeCloseTo(250);
  expect(moved.y).toBeCloseTo(200);
  expect(moved.rotation).toBe(25);
  await drag(page, '[data-resize-edge="se"]', 45 * s, 45 * s);
  const resized = (await saved(page)).blocks.find((b) => b.id === "decor")!;
  expect(resized.width).toBeGreaterThan(moved.width);
  expect(resized.height).toBeGreaterThan(moved.height);
  expect(resized.rotation).toBe(25);
});
for (const width of [320, 390, 768])
  test(`mobile ${width}: canvas stays visible, sheet swipe, hold drag, scrolling and zoom`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await setup(page, {
      ...fixture,
      blocks: [
        fixture.blocks[0],
        {
          ...newBlock("text"),
          id: "bottom",
          name: "Нижний блок",
          row: 24,
          col: 0,
        },
      ],
    });
    await page.waitForTimeout(600);
    await page
      .getByRole("button", { name: "Открыть библиотеку", exact: true })
      .click();
    await expect(page.locator(".workspace")).toBeVisible();
    await expect(page.locator(".library")).toBeVisible();
    await page
      .getByRole("button", { name: "Добавить: Изображение", exact: true })
      .click();
    await expect(page.locator(".inspector")).toBeVisible();
    await expect(page.locator("[data-selection-id]")).toHaveCount(1);
    const medium = (await page.locator(".mobile-sheet").boundingBox())!;
    await drag(page, ".sheet-grip", 0, -260);
    await expect(page.locator(".mobile-sheet")).toHaveAttribute(
      "data-sheet-size",
      "full",
    );
    expect(
      (await page.locator(".mobile-sheet").boundingBox())!.height,
    ).toBeGreaterThan(medium.height);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const block = document
              .querySelector("[data-selection-id]")!
              .getBoundingClientRect(),
            sheet = document
              .querySelector(".mobile-sheet")!
              .getBoundingClientRect(),
            area = document
              .querySelector(".canvas-scroll")!
              .getBoundingClientRect();
          return (
            Math.min(block.bottom, sheet.top) - Math.max(block.top, area.top)
          );
        }),
      )
      .toBeGreaterThan(0);
    await page
      .getByLabel("Название блока", { exact: true })
      .fill("Фото с телефона");
    await page.setViewportSize({ width, height: 550 });
    await expect(page.locator(".mobile-tool-dock")).toBeInViewport();
    await expect(
      page.getByLabel("Название блока", { exact: true }),
    ).toBeInViewport();
    await page.setViewportSize({ width, height: 844 });
    await page
      .getByRole("button", { name: "Свернуть панель", exact: true })
      .click();
    await page.waitForTimeout(650);
    const s = await scale(page);
    await page.locator('[data-block-id="text"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await touch(context, page, '[data-block-id="text"]', 0, 128 * s, 450);
    await expect.poll(async () => (await saved(page)).blocks[0].row).toBe(2);
    const after = await saved(page);
    await page.waitForTimeout(600);
    await page.locator('[data-block-id="text"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const scrollBefore = await page
      .locator(".canvas-scroll")
      .evaluate((el) => el.scrollTop);
    await touch(context, page, '[data-block-id="text"]', 0, -75);
    await expect
      .poll(() => page.locator(".canvas-scroll").evaluate((el) => el.scrollTop))
      .toBeGreaterThan(scrollBefore);
    await page.waitForTimeout(200);
    expect((await saved(page)).blocks).toEqual(after.blocks);
    await page
      .getByRole("button", { name: "Открыть настройки", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Открыть масштаб", exact: true })
      .click();
    const before = await scale(page);
    await page.getByRole("button", { name: "Увеличить", exact: true }).click();
    await expect.poll(() => scale(page)).toBeGreaterThan(before);
    await page
      .getByRole("button", { name: "По ширине", exact: true })
      .last()
      .click();
    await expect.poll(() => scale(page)).toBeCloseTo(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await context.close();
  });
test("layer grip changes only stack; preview and public viewer agree", async ({
  page,
}, testInfo) => {
  await setup(page, {
    ...fixture,
    blocks: fixture.blocks.map((b) =>
      b.id === "text" ? { ...b, locked: true, hidden: false } : b,
    ),
  });
  await page.getByRole("button", { name: /^Слои/ }).click();
  const target = (await page.locator('[data-layer-id="text"]').boundingBox())!,
    grip = (await page
      .locator('[data-layer-id="decor"] .layer-grip')
      .boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height - 3,
    { steps: 8 },
  );
  await page.mouse.up();
  const p = await saved(page);
  expect(orderedLayers(p.blocks)[0].id).toBe("decor");
  expect(p.blocks.map((b) => [b.id, b.col, b.row, b.x, b.y])).toEqual(
    fixture.blocks.map((b) => [b.id, b.col, b.row, b.x, b.y]),
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toMatch(/\.json$/);
  const backup = testInfo.outputPath("layers.json");
  await exported.saveAs(backup);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  await expect(page.locator("[data-block-id]")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Файл проекта JSON", { exact: true })
    .setInputFiles(backup);
  await expect
    .poll(async () => (await saved(page)).blocks.length)
    .toBe(p.blocks.length);
  expect((await saved(page)).blocks).toEqual(p.blocks);
  const editorZ = await page
    .locator('[data-block-id="decor"]')
    .evaluate((el) => getComputedStyle(el).zIndex);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator('[data-block-id="decor"]')).toHaveCSS(
    "z-index",
    editorZ,
  );
  await expect(page.locator("[data-resize-edge]")).toHaveCount(0);
  if (process.env.ZIN_CANVAS_E2E === "1") {
    await page.route("**/rest/v1/published_pages*", (route) =>
      route.fulfill({ json: { project: p } }),
    );
    await page.goto("/u/zin_layers");
    await expect(page.locator('[data-block-id="decor"]')).toHaveCSS(
      "z-index",
      editorZ,
    );
  }
});

test("touch layers expose held actions, lock selection, background order and finger-sized resize", async ({
  browser,
}) => {
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    }),
    page = await context.newPage();
  await setup(page, {
    ...fixture,
    blocks: [fixture.blocks[0], fixture.blocks[2]],
  });
  await page.getByRole("button", { name: "Открыть слои", exact: true }).tap();
  await page.locator('[data-layer-id="text"] .layer-select').tap();
  await page
    .getByRole("button", { name: "Закрепить: Текст", exact: true })
    .tap();
  await expect(
    page.locator('[data-selection-id="text"] .selection-unlock'),
  ).toBeVisible();
  await touch(context, page, '[data-layer-id="text"] .layer-select', 0, 0, 550);
  await page
    .getByRole("button", { name: "Дублировать: Текст", exact: true })
    .tap();
  const copy = (await saved(page)).blocks.find(
    (b) => b.name === "Текст — копия",
  )!;
  expect(copy.locked).toBe(false);
  await touch(
    context,
    page,
    '[data-layer-id="decor"] .layer-select',
    0,
    0,
    550,
  );
  await page
    .getByRole("button", { name: "На задний план: Рамка", exact: true })
    .tap();
  expect(orderedLayers((await saved(page)).blocks)[0].id).toBe("decor");
  await page.locator(`[data-layer-id="${copy.id}"] .layer-select`).tap();
  await page
    .getByRole("button", { name: "Свернуть панель", exact: true })
    .tap();
  await page.waitForTimeout(700);
  const s = await scale(page);
  await touch(context, page, '[data-resize-edge="s"]', 0, 128 * s);
  await expect
    .poll(
      async () =>
        (await saved(page)).blocks.find((b) => b.id === copy.id)!.rowSpan,
    )
    .toBe(copy.rowSpan + 1);
  await context.close();
});
