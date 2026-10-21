import { writeFileSync } from "node:fs";
import { DEFAULT_ANIMATION } from "../src/model/effects";
import { test, expect, type Page } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
async function seed(page: Page, project = emptyProject()) {
  await page.addInitScript(
    ({ key, project }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(project));
    },
    { key: KEY, project },
  );
}
async function stored(page: Page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function text(page: Page, value: string) {
  await page
    .getByRole("button", { name: "Добавить: Текст", exact: true })
    .click();
  await page.getByLabel("Текст", { exact: true }).fill(value);
}
test("two tabs preserve both edits, stop stale writes, and recover prior versions", async ({
  page,
  context,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await seed(page);
  await page.goto("/editor");
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/editor");
  await expect(
    other.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  await text(page, "Первая вкладка");
  await expect
    .poll(async () => (await stored(page)).blocks[0]?.content)
    .toBe("Первая вкладка");
  await expect(
    other.getByText(
      "Конфликт локальных версий: автоматическая перезапись остановлена.",
    ),
  ).toBeVisible();
  await text(other, "Вторая вкладка");
  await other
    .getByRole("button", { name: "Ошибка сохранения", exact: true })
    .click();
  expect((await stored(page)).blocks[0].content).toBe("Первая вкладка");
  other.on("dialog", (dialog) => dialog.accept());
  await other
    .getByRole("button", { name: "Оставить текущую версию", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(other)).blocks[0]?.content)
    .toBe("Вторая вкладка");
  await page.reload();
  await page
    .getByRole("button", { name: "Восстановление проекта", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Восстановление проекта" });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      (key) =>
        Object.keys(localStorage)
          .filter((k) => k.startsWith(key + ".recovery."))
          .map((k) => localStorage.getItem(k))
          .join("\n"),
      KEY,
    ),
  ).toContain("Первая вкладка");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Восстановление проекта", exact: true }),
  ).toBeFocused();
});
test("damaged canonical JSON is protected until an explicit choice and can be downloaded", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{broken-original"),
    KEY,
  );
  await page.goto("/editor");
  await expect(page.locator(".local-conflict")).toBeVisible();
  await page
    .getByRole("button", { name: "Добавить: Текст", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ошибка сохранения", exact: true })
    .click();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(
    "{broken-original",
  );
  await page
    .getByRole("button", { name: "Восстановление проекта", exact: true })
    .click();
  const original = page
    .getByRole("dialog")
    .locator("section")
    .filter({ hasText: "Повреждённые исходные данные" });
  const download = page.waitForEvent("download");
  await original.getByRole("button", { name: "Скачать исходный JSON" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toBe("{broken-original");
  await page.keyboard.press("Escape");
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Оставить текущую версию", exact: true })
    .click();
  await expect(page.locator(".local-conflict")).toHaveCount(0);
  expect((await stored(page)).version).toBe(1);
});
test("quota errors leave canonical data intact and allow a current JSON backup", async ({
  page,
}) => {
  await seed(page);
  await page.addInitScript((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, value) {
      if (k.startsWith(key))
        throw new DOMException("quota", "QuotaExceededError");
      return original.call(this, k, value);
    };
  }, KEY);
  await page.goto("/editor");
  await text(page, "Не теряйте эту работу");
  await page
    .getByRole("button", { name: "Ошибка сохранения", exact: true })
    .click();
  await expect(
    page.getByText(/Не удалось сохранить: хранилище браузера/),
  ).toBeVisible();
  expect((await stored(page)).blocks).toHaveLength(0);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON", exact: true }).click();
  const stream = await (await pending).createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).blocks[0].content).toBe(
    "Не теряйте эту работу",
  );
});
test("offline edits flush on pagehide and restore without cloud availability", async ({
  page,
  context,
}) => {
  await seed(page);
  await page.goto("/editor");
  await expect(
    page.getByRole("button", { name: "Добавить: Текст", exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await text(page, "Работа без сети");
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect((await stored(page)).blocks[0].content).toBe("Работа без сети");
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator(".text-content")).toHaveText("Работа без сети");
});
test("imported text remains inert and executable links do not render", async ({
  page,
}) => {
  const project = emptyProject();
  project.blocks = [
    { ...newBlock("text"), content: '<img src=x onerror="window.ZIN_XSS=1">' },
    { ...newBlock("link"), row: 2, url: "javascript:window.ZIN_XSS=1" },
  ];
  await seed(page, project);
  await page.goto("/preview");
  await expect(page.locator(".text-content")).toContainText("<img");
  await expect(page.locator(".type-link a")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { ZIN_XSS?: number }).ZIN_XSS,
    ),
  ).toBeUndefined();
});
for (const width of [320, 390, 768])
  test(`mobile ${width}: panel keyboard navigation, Escape and focus recovery`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await seed(page);
    await page.goto("/editor");
    const trigger = page.getByRole("button", {
      name: "Открыть настройки страницы",
      exact: true,
    });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    const handle = page.getByRole("button", { name: "Изменить высоту панели" });
    await handle.focus();
    await page.keyboard.press("ArrowUp");
    await expect(page.locator(".mobile-sheet")).toHaveAttribute(
      "data-sheet-size",
      "full",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator(".mobile-sheet")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
for (const count of [100, 200])
  test(`performance: ${count} mixed blocks remain editable and offscreen effects pause`, async ({
    page,
  }, testInfo) => {
    test.skip(
      process.env.TEST_PRODUCTION !== "1",
      "Performance budgets require a production build, not Vite development transforms.",
    );
    test.setTimeout(60000);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      const Original = window.IntersectionObserver;
      (window as unknown as { zinObservers: number }).zinObservers = 0;
      window.IntersectionObserver = class extends Original {
        private active = true;
        constructor(
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit,
        ) {
          super(callback, options);
          (window as unknown as { zinObservers: number }).zinObservers++;
        }
        override disconnect() {
          if (this.active) {
            this.active = false;
            (window as unknown as { zinObservers: number }).zinObservers--;
          }
          super.disconnect();
        }
      };
    });
    const project: Project = emptyProject();
    project.blocks = Array.from({ length: count }, (_, index) => ({
      ...newBlock(index % 4 === 0 ? "gif" : "text"),
      id: `load-${index}`,
      row: Math.floor(index / 4),
      col: index % 4,
      rowSpan: 1,
      content: `Блок ${index}`,
      effects:
        index % 3 === 0
          ? { animation: { ...DEFAULT_ANIMATION, type: "float" } }
          : undefined,
      url: index % 4 === 0 ? "http://127.0.0.1:5180/templates/v1/star.gif" : "",
    }));
    await seed(page, project);
    const started = Date.now();
    await page.goto("/editor");
    await expect(page.locator("[data-block-id]")).toHaveCount(count, {
      timeout: 10000,
    });
    await page.locator('[data-block-id="load-1"]').click();
    await page.getByLabel("Текст", { exact: true }).fill("Редактируется");
    await expect
      .poll(async () => (await stored(page)).blocks[1]?.content)
      .toBe("Редактируется");
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(20000);
    const measurementPath = testInfo.outputPath(`performance-${count}.json`);
    writeFileSync(
      measurementPath,
      JSON.stringify(
        {
          blocks: count,
          cpuSlowdown: 4,
          loadAndEditMs: elapsed,
          domNodes: await page.locator("*").count(),
        },
        null,
        2,
      ),
    );
    await testInfo.attach(`performance-${count}.json`, {
      path: measurementPath,
      contentType: "application/json",
    });
    await page
      .getByRole("button", { name: "Предпросмотр", exact: true })
      .click();
    await expect(page.locator(".zin-preloader")).toHaveCount(0);
    await expect(page.locator("[data-block-id]")).toHaveCount(count);
    await expect
      .poll(() =>
        page
          .locator(
            ".effect-root[data-effect-active=true][data-effect-visible=false]",
          )
          .count(),
      )
      .toBeGreaterThan(0);
    for (let cycle = 0; cycle < 2; cycle++) {
      await page
        .getByRole("link", { name: "Вернуться в редактор", exact: true })
        .click();
      await expect(page.locator(".canvas-editing")).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            () => (window as unknown as { zinObservers: number }).zinObservers,
          ),
        )
        .toBe(0);
      if (cycle === 0) {
        await page
          .getByRole("button", { name: "Предпросмотр", exact: true })
          .click();
        await expect(page.locator(".zin-preloader")).toHaveCount(0);
      }
    }
  });
