import { test, expect } from "@playwright/test";
import type { Project } from "../src/model/types";
import { emptyProject, newBlock } from "../src/model/defaults";
const key = "link-canvas.project.v1";
for (const width of [320, 360, 390, 430, 1440])
  test(`RAW SIGNAL landing ${width}: headline, navigation and real actions`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("САЙТ НЕОБЯЗАНБЫТЬНОРМАЛЬНЫМ.");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const span of await heading.locator("span").all()) {
      const r = (await span.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
    }
    await expect(
      page.locator(".raw-actions").getByRole("link", { name: "Создать ZIN" }),
    ).toHaveAttribute("href", "/editor");
    await expect(page.locator(".raw-actions a").last()).toHaveAttribute(
      "href",
      "/explore",
    );
    if (width < 720) {
      await page.getByRole("button", { name: "Открыть меню" }).click();
      await expect(page.locator("#home-navigation")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Открыть меню" }),
      ).toBeFocused();
    }
  });
for (const width of [320, 390, 1440])
  test(`RAW editor ${width}: properties layers grid contrast and publication`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const project = {
      ...emptyProject(),
      page: { ...emptyProject().page, background: "#ffffff" },
      blocks: [
        {
          ...newBlock("text"),
          id: "test",
          name: "Мой текст",
          content: "НЕ МЕНЯТЬ АВТОРСКИЙ СТИЛЬ",
          background: "#f0cafe",
          color: "#201020",
        },
      ],
    };
    await page.addInitScript(
      ({ key, project }) => localStorage.setItem(key, JSON.stringify(project)),
      { key, project },
    );
    await page.goto("/editor");
    await expect(page.locator(".editor-toolbar")).toBeVisible();
    const grid = page.locator(".workspace .grid-cell").first();
    await expect(grid).toHaveCSS("border-top-color", "rgba(32, 14, 31, 0.62)");
    await page.getByLabel("Видимость сетки").selectOption("hidden");
    await expect(grid).toHaveCSS("visibility", "hidden");
    await page.getByLabel("Видимость сетки").selectOption("auto");
    await page.locator('[data-block-id="test"]').click();
    if (width < 1050) {
      await expect(page.locator(".mobile-tool-dock button")).toHaveCount(4);
      await page.getByRole("button", { name: "Изменить", exact: true }).click();
    }
    await page.getByLabel("Текст", { exact: true }).fill("ЖИВОЙ ZIN");
    await expect
      .poll(() =>
        page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!).blocks[0].content,
          key,
        ),
      )
      .toBe("ЖИВОЙ ZIN");
    if (width < 1050) {
      await page
        .getByRole("button", { name: "Открыть слои", exact: true })
        .first()
        .click();
      await expect(page.locator(".library")).toBeVisible();
      await page
        .getByRole("button", { name: "Открыть публикацию", exact: true })
        .click();
      await expect(page.locator(".mobile-publication")).toBeVisible();
      await expect(page.locator(".workspace")).toBeVisible();
      await page.getByRole("button", { name: "Свернуть панель" }).click();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.goto("/preview");
    await expect(page.locator(".preview-page")).toHaveCSS(
      "background-color",
      "rgb(255, 255, 255)",
    );
    await expect(page.locator(".grid-cell")).toHaveCount(0);
    await expect(page.locator(".block-content")).toHaveCSS(
      "background-color",
      "rgb(240, 202, 254)",
    );
  });
test("dark grid and short mobile viewport keep settings accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 480 });
  await page.goto("/editor");
  await expect(page.locator(".editor-toolbar")).toBeVisible();
  await expect(page.locator(".grid-cell").first()).toHaveCSS(
    "border-top-color",
    "rgba(255, 225, 242, 0.65)",
  );
  await page
    .getByRole("button", { name: "Открыть настройки", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть настройки страницы", exact: true })
    .click();
  await expect(page.locator(".inspector")).toBeVisible();
  expect(
    (await page.locator(".inspector").boundingBox())!.height,
  ).toBeGreaterThan(100);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Открыть настройки", exact: true }),
  ).toBeFocused();
});

for (const grouped of [false, true])
  test(`mobile direct move ${grouped ? "group" : "block"}: touch without long press and undo`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 900 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    try {
      const project: Project = {
        ...emptyProject(),
        blocks: [
          {
            ...newBlock("text"),
            id: "free-test",
            layout: "free",
            x: 80,
            y: 60,
            width: 220,
            height: 140,
            content: "ДВИГАЙ МЕНЯ",
          },
        ],
      };
      if (grouped) {
        project.groups = [{ id: "touch-group", name: "Коллаж" }];
        project.blocks[0].groupId = "touch-group";
        project.blocks.push({ ...project.blocks[0], id: "second", x: 330 });
      }
      await page.addInitScript(
        ({ key, project }) =>
          localStorage.setItem(key, JSON.stringify(project)),
        { key, project },
      );
      await page.goto("/editor");
      await expect(page.locator('[data-block-id="free-test"]')).toBeVisible();
      await page.locator('[data-block-id="free-test"]').tap();
      await page.getByRole("button", { name: "Двигать", exact: true }).tap();
      await expect(page.locator(".editor-shell")).toHaveAttribute(
        "data-direct-move",
        "true",
      );
      const rect = (await page
        .locator(
          grouped
            ? '[data-selection-id="__selection__"]'
            : '[data-block-id="free-test"]',
        )
        .boundingBox())!;
      const client = await context.newCDPSession(page),
        x = rect.x + rect.width / 2,
        y = rect.y + rect.height / 2;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 8; i++)
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + i * 5, y: y + i * 3 }],
        });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!).blocks[0].x,
            key,
          ),
        )
        .toBeGreaterThan(80);
      await page.getByRole("button", { name: "Отменить", exact: true }).tap();
      await expect
        .poll(() =>
          page.evaluate(
            (key) => JSON.parse(localStorage.getItem(key)!).blocks[0].x,
            key,
          ),
        )
        .toBe(80);
    } finally {
      await context.close();
    }
  });
