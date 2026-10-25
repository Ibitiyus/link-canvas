import { test, expect, type Page } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import { TEMPLATE_CATALOG } from "../src/templates/catalog";
const KEY = "link-canvas.project.v1";
const initial = {
  ...emptyProject(),
  blocks: [
    {
      ...newBlock("text"),
      id: "original",
      content: "НЕ ТЕРЯТЬ МОЙ ПРОЕКТ",
      name: "Исходный",
    },
  ],
};
async function setup(page: Page) {
  await page.addInitScript((p) => {
    if (!localStorage.getItem("link-canvas.project.v1"))
      localStorage.setItem("link-canvas.project.v1", JSON.stringify(p));
  }, initial);
  await page.goto("/templates");
  await expect(
    page.getByRole("heading", { name: "Cybercore", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
for (const t of TEMPLATE_CATALOG)
  test(`${t.name}: anonymous preview and editable starter survive reload without losing cancelled draft`, async ({
    page,
  }) => {
    await setup(page);
    const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
    await page
      .locator(`[data-template-id="${t.id}"]`)
      .getByRole("link", { name: "Предпросмотр", exact: true })
      .click();
    await expect(page.locator(".canvas-renderer")).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
      raw,
    );
    await page
      .getByRole("button", { name: "Использовать шаблон", exact: true })
      .click();
    await page.getByRole("button", { name: "Отмена", exact: true }).click();
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
      raw,
    );
    await page
      .getByRole("button", { name: "Использовать шаблон", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Заменить страницу", exact: true })
      .click();
    await expect(page).toHaveURL(/\/editor$/);
    const p = await saved(page);
    expect(p.blocks.some((b: { id: string }) => b.id === "original")).toBe(
      false,
    );
    expect(p.blocks.length === 0).toBe(t.id === "blank-canvas");
    for (const block of p.blocks)
      if (["image", "gif", "video", "audio"].includes(block.type) && block.url)
        expect(block.url).toMatch(/^asset:/);
    if (p.blocks.length) {
      await page.locator("[data-block-id]").first().click();
      await expect(
        page
          .getByLabel("Название блока", { exact: true })
          .or(page.getByLabel("Название группы", { exact: true })),
      ).toBeVisible();
    }
    await page.reload();
    expect(await saved(page)).toEqual(p);
    await page.goto("/templates");
    await page
      .getByRole("button", {
        name: "Восстановить предыдущую страницу",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Заменить страницу", exact: true })
      .click();
    expect((await saved(page)).blocks[0].content).toBe(
      initial.blocks[0].content,
    );
  });
test("local templates copy files, rename, reuse, export/import and delete independently of a page", async ({
  page,
}, info) => {
  await setup(page);
  await page
    .locator('[data-template-id="music-artist"]')
    .getByRole("button", { name: "Использовать", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  await saved(page);
  await page
    .getByRole("button", { name: "Сохранить как шаблон", exact: true })
    .click();
  await page.getByLabel("Название шаблона", { exact: true }).fill("Мой релиз");
  await page
    .getByRole("button", { name: "Сохранить шаблон", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const source = await saved(page);
  await page.getByRole("link", { name: "Шаблоны ↗", exact: true }).click();
  await page.getByRole("button", { name: "Мои", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Мой релиз", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".template-live")).toHaveAttribute("inert", "");
  await expect(page.locator(".template-card a a")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Переименовать", exact: true })
    .click();
  await page.getByLabel("Новое название", { exact: true }).fill("Релиз 02");
  await page
    .getByRole("button", { name: "Сохранить название", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Релиз 02", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Использовать", exact: true }).click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  const reused = await saved(page);
  expect(reused.blocks.map((b: { content: string }) => b.content)).toEqual(
    source.blocks.map((b: { content: string }) => b.content),
  );
  expect(reused.blocks[0].id).not.toBe(source.blocks[0].id);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const file = info.outputPath("template.json");
  await (await event).saveAs(file);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Сбросить страницу", exact: true })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByLabel("Файл проекта JSON", { exact: true })
    .setInputFiles(file);
  await expect(page.locator("[data-block-id]")).toHaveCount(
    reused.blocks.length,
  );
  expect(
    (await saved(page)).blocks.find((b: { type: string }) => b.type === "audio")
      .url,
  ).toMatch(/^asset:/);
  await page.goto("/templates");
  await page.getByRole("button", { name: "Мои", exact: true }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page
    .getByRole("button", { name: "Удалить шаблон", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Релиз 02", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).blocks.length,
      KEY,
    ),
  ).toBe(reused.blocks.length);
});
for (const width of [320, 390, 768])
  test(`mobile ${width}: filters, lazy previews, direct canvas entry and fixed geometry`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const media: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/templates/v1/")) media.push(r.url());
    });
    await setup(page);
    expect(media).toHaveLength(0);
    await page.getByRole("button", { name: "Музыка", exact: true }).click();
    await expect(page.locator("[data-template-id]")).toHaveCount(1);
    await page
      .getByRole("button", { name: "Использовать", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Заменить страницу", exact: true })
      .click();
    await expect(page.locator(".workspace")).toBeVisible();
    await expect(page.locator(".mobile-sheet")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const p = await saved(page);
    expect(p.page.columns).toBe(4);
    await page.goto("/preview");
    await expect(
      page.getByRole("button", { name: "Воспроизвести музыку", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Воспроизвести музыку", exact: true })
      .click();
    await expect
      .poll(() =>
        page.locator("audio").evaluate((e: HTMLAudioElement) => e.currentTime),
      )
      .toBeGreaterThan(0);
  });
test("a failed media download leaves the draft unchanged and reports an error", async ({
  page,
}) => {
  await setup(page);
  const raw = await page.evaluate((key) => localStorage.getItem(key), KEY);
  await page.route("**/templates/v1/*.webp", (r) =>
    r.fulfill({ status: 503, body: "unavailable" }),
  );
  await page
    .locator('[data-template-id="cybercore"]')
    .getByRole("button", { name: "Использовать", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Не удалось загрузить",
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    raw,
  );
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.route("**/templates/v1/*.webp", (r) =>
    r.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html>SPA fallback</html>",
    }),
  );
  await page
    .locator('[data-template-id="cybercore"]')
    .getByRole("button", { name: "Использовать", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "неподдерживаемый файл",
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    raw,
  );
});
test("an old gallery tab cannot overwrite a newer draft from another tab", async ({
  page,
  context,
}) => {
  await setup(page);
  const editor = await context.newPage();
  await editor.goto("/editor");
  await editor.locator('[data-block-id="original"]').click();
  await editor
    .getByLabel("Текст", { exact: true })
    .fill("НОВАЯ ВЕРСИЯ В ДРУГОЙ ВКЛАДКЕ");
  await saved(editor);
  await page
    .locator('[data-template-id="blank-canvas"]')
    .getByRole("link", { name: "Предпросмотр", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Использовать шаблон", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "другой вкладке",
  );
  await page.close();
  await editor.reload();
  expect((await saved(editor)).blocks[0].content).toBe(
    "НОВАЯ ВЕРСИЯ В ДРУГОЙ ВКЛАДКЕ",
  );
});
test("a corrupted existing draft is not replaced with a template or demo backup", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(
    (key) => localStorage.setItem(key, "{broken original"),
    KEY,
  );
  await page.reload();
  await page
    .locator('[data-template-id="blank-canvas"]')
    .getByRole("button", { name: "Использовать", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Заменить страницу", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "JSON",
  );
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    "{broken original",
  );
});
test("the home page exposes the gallery on a small phone without requiring registration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await page
    .getByRole("link", { name: "Начать с шаблона ↗", exact: true })
    .click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(
    page.getByRole("heading", { name: "Cybercore", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("a grouped free collage preserves logical geometry on desktop tablet and phones", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.goto("/templates/punk-zine");
  await expect(page.locator(".effect-group")).toHaveCount(1);
  const geometry = () =>
    page.locator(".canvas-renderer").evaluate((root) => {
      const scale = Number(root.getAttribute("data-canvas-scale")),
        origin = root.querySelector(".canvas")!.getBoundingClientRect();
      return [...root.querySelectorAll("[data-block-id]")].map((e) => {
        const r = e.getBoundingClientRect();
        return {
          id: e.getAttribute("data-block-id"),
          x: (r.x - origin.x) / scale,
          y: (r.y - origin.y) / scale,
          w: r.width / scale,
          h: r.height / scale,
        };
      });
    });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const original = await geometry();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const current = await geometry();
    expect(current.map((b) => b.id)).toEqual(original.map((b) => b.id));
    for (let i = 0; i < current.length; i++)
      for (const key of ["x", "y", "w", "h"] as const)
        expect(Math.abs(current[i][key] - original[i][key])).toBeLessThan(0.3);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY),
  ).toEqual(initial);
});
