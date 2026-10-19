import { test, expect } from "@playwright/test";
import { demoProject } from "../src/model/defaults";
const KEY = "link-canvas.project.v1";

test("existing custom page keeps its data and styling in editor and preview", async ({
  page,
}) => {
  const project = demoProject();
  project.page = {
    ...project.page,
    background: "#ffffff",
    font: "serif",
    maxWidth: 800,
    gap: 18,
  };
  project.blocks = [
    {
      ...project.blocks[0],
      content: "My green page",
      background: "#12a150",
      color: "#021b0c",
      radius: 35,
      fontSize: 28,
      opacity: 0.8,
    },
  ];
  await page.addInitScript(
    ({ key, project }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(project));
    },
    { key: KEY, project },
  );
  await page.goto("/editor");
  await expect(page.locator(".block-content")).toHaveCSS(
    "background-color",
    "rgb(18, 161, 80)",
  );
  await expect(page.locator(".block-content")).toHaveCSS(
    "border-radius",
    "35px",
  );
  await expect(page.locator(".page-surface")).toHaveCSS(
    "font-family",
    "Georgia, serif",
  );
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
  ).toEqual(project);
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(page.locator(".preview-page")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator(".block-content")).toHaveCSS(
    "background-color",
    "rgb(18, 161, 80)",
  );
  await expect(page.locator(".block-content")).toHaveCSS(
    "color",
    "rgb(2, 27, 12)",
  );
  await expect(page.locator(".block-content")).toHaveCSS("opacity", "0.8");
  await expect(page.locator(".page-surface")).toHaveCSS(
    "font-family",
    "Georgia, serif",
  );
  await page
    .getByRole("button", { name: "Скрыть подсказку", exact: true })
    .click();
  await expect(page.locator(".preview-notice")).toHaveCount(0);
  await page.reload();
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
  ).toEqual(project);
});

test("live homepage playground edits are separate from the saved project and media play", async ({
  page,
}) => {
  await page.goto("/");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), KEY))
    .not.toBeNull();
  const original = await page.evaluate((key) => localStorage.getItem(key), KEY);
  const showcase = page.getByTestId("showcase");
  const handle = showcase.getByRole("button", {
    name: "Изменить размер: Манифест",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const rect = (await handle.boundingBox())!;
  await page.mouse.move(rect.x + 10, rect.y + 10);
  await page.mouse.down();
  await page.mouse.move(rect.x + 10, rect.y + 100, { steps: 5 });
  await page.mouse.up();
  await expect(
    showcase.locator("[data-block-id=spec-text] .size-badge"),
  ).toHaveText("2 × 4");
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    original,
  );
  await showcase
    .getByRole("button", { name: "Смотреть пример", exact: true })
    .click();
  await expect(showcase.locator(".drag-handle, .resize-handle")).toHaveCount(0);
  await expect(
    showcase.getByRole("link", { name: "Instagram", exact: true }),
  ).toHaveAttribute("href", "https://www.instagram.com/");
  await showcase.locator("video").evaluate(async (el: HTMLVideoElement) => {
    el.muted = true;
    await el.play();
  });
  await expect
    .poll(() =>
      showcase
        .locator("video")
        .evaluate((el: HTMLVideoElement) => el.currentTime),
    )
    .toBeGreaterThan(0);
  await showcase
    .getByRole("button", { name: "Редактировать пример", exact: true })
    .click();
  await expect(showcase.locator(".drag-handle")).toHaveCount(7);
});

test("responsive compositions and panel switching fit phones, tablets, laptops and monitors", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/editor", "/missing-page"]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
      const clippedHeadings = await page
        .locator("h1, h2, h3")
        .evaluateAll((nodes) =>
          nodes
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              return (
                rect.width > 0 &&
                (node.scrollWidth > node.clientWidth + 1 ||
                  rect.left < -1 ||
                  rect.right > innerWidth + 1)
              );
            })
            .map((node) => node.textContent),
        );
      expect(clippedHeadings, `${route} headings at ${width}px`).toEqual([]);
    }
    if (width <= 1050) {
      await page.goto("/editor");
      const toolbar = (await page.locator(".editor-toolbar").boundingBox())!;
      for (const name of ["Предпросмотр", "Сохранено"]) {
        if (name === "Сохранено")
          await expect(
            page.getByRole("button", { name, exact: true }),
          ).toBeVisible();
        const rect = (await page
          .getByRole("button", { name, exact: true })
          .boundingBox())!;
        expect(rect.y).toBeGreaterThanOrEqual(toolbar.y);
        expect(rect.y + rect.height).toBeLessThanOrEqual(
          toolbar.y + toolbar.height,
        );
      }
      await expect(page.locator(".workspace")).toBeVisible();
      await expect(page.locator(".library")).toBeHidden();
      await page
        .getByRole("button", { name: "Открыть библиотеку", exact: true })
        .click();
      await expect(page.locator(".library")).toBeVisible();
      await expect(page.locator(".workspace")).toBeHidden();
      await page
        .getByRole("button", { name: "Добавить: Текст", exact: true })
        .click();
      await expect(page.locator(".inspector")).toBeVisible();
      await page.getByLabel("Текст", { exact: true }).fill("Mobile editor");
      await page
        .getByRole("button", { name: "Открыть полотно", exact: true })
        .click();
      await expect(page.locator(".workspace")).toBeVisible();
      await expect(page.locator(".text-content").last()).toHaveText(
        "Mobile editor",
      );
    }
  }
});

test("reduced motion stops the decorative animation and provides a still GIF preview", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero-heading")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(
    page.locator("[data-block-id=spec-gif] img"),
  ).not.toHaveAttribute("src", /\.gif$/);
  const handle = page.getByRole("button", {
    name: "Переместить: Постер",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const rect = (await handle.boundingBox())!;
  await page.mouse.move(rect.x + 8, rect.y + 8);
  await page.mouse.down();
  await page.mouse.move(rect.x + 8, rect.y + 98, { steps: 5 });
  await expect(page.locator(".drop-ghost")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator("[data-block-id=spec-image]")).toHaveCSS(
    "grid-row-start",
    "2",
  );
});

test("not found page offers working routes back into the application", async ({
  page,
}) => {
  await page.goto("/this-page-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "ВЫ ВЫШЛИ ЗА РАМКИ." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Открыть редактор", exact: true })
    .click();
  await expect(page).toHaveURL(/\/editor$/);
});
