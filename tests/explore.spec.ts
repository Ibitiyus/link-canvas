import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { emptyProject, newBlock } from "../src/model/defaults";
const KEY = "link-canvas.project.v1";
const cover =
  "data:image/jpeg;base64," +
  readFileSync("tests/fixtures/explore-cover.jpg").toString("base64");
const cards = Array.from({ length: 17 }, (_, i) => ({
  username: `artist_${i}`,
  title: i === 0 ? "НЕОН И ШУМ" : `Мир автора ${i}`,
  description:
    i === 0 ? "Независимый цифровой коллаж" : "Музыка и собственные правила",
  category: i % 2 ? "Music" : "Art & Design",
  cover: i === 0 ? cover : "",
  listed_at: new Date(Date.UTC(2026, 9, 23 - i)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 9, 23 - i)).toISOString(),
}));
async function setup(page: Page, source = cards) {
  const requests: Record<string, any>[] = [];
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    {
      key: KEY,
      value: JSON.stringify({
        ...emptyProject(),
        blocks: [{ ...newBlock("text"), content: "ЛИЧНЫЙ ЧЕРНОВИК" }],
      }),
    },
  );
  await page.route("**/rest/v1/rpc/search_explore", async (route) => {
    const p = route.request().postDataJSON();
    requests.push(p);
    let list = source.filter(
      (c) =>
        (!p.category_filter || c.category === p.category_filter) &&
        (!p.search_text ||
          `${c.username} ${c.title} ${c.description}`
            .toLowerCase()
            .includes(p.search_text.toLowerCase())),
    );
    if (p.sort_order === "random") list = [...list].reverse();
    await route.fulfill({
      json: {
        items: list.slice(p.page_offset, p.page_offset + p.page_size),
        has_more: list.length > p.page_offset + p.page_size,
        next_offset: p.page_offset + p.page_size,
      },
    });
  });
  await page.goto("/explore");
  await expect(
    page.getByRole("heading", { name: "ЧУЖОЙ МИР. ТВОЁ ВДОХНОВЕНИЕ." }),
  ).toBeVisible();
  return requests;
}
test("anonymous gallery: empty, no fabricated people, preserves local draft", async ({
  page,
}) => {
  await setup(page, []);
  await expect(
    page.getByRole("heading", { name: "Эта галерея начинается с вас" }),
  ).toBeVisible();
  expect(
    (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY))
      .blocks[0].content,
  ).toBe("ЛИЧНЫЙ ЧЕРНОВИК");
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.locator("meta[name=description]")).toHaveAttribute(
    "content",
    /авторские ZIN/,
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "http://127.0.0.1:5180/explore",
  );
  await page.goto("/preview/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await page.goto("/explore");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
});
test("bounded pagination, debounce, categories, sorting and no heavy media requests", async ({
  page,
}) => {
  const media: string[] = [];
  page.on("request", (request) => {
    if (
      /\.(gif|mp4|webm|mp3|woff2?)($|\?)/.test(request.url()) &&
      !request.url().includes("/assets/")
    )
      media.push(request.url());
  });
  const requests = await setup(page);
  await expect(page.locator(".explore-card")).toHaveCount(12);
  expect(requests[0].page_size).toBe(12);
  await expect(
    page.locator(
      ".explore-grid video,.explore-grid audio,.explore-grid iframe,.explore-grid canvas",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".explore-grid img").first()).toHaveAttribute(
    "loading",
    "lazy",
  );
  await page.getByRole("button", { name: "Показать ещё" }).click();
  await expect(page.locator(".explore-card")).toHaveCount(17);
  await expect(page.getByRole("button", { name: "Показать ещё" })).toHaveCount(
    0,
  );
  const before = requests.length;
  await page.getByRole("searchbox").fill("artist_16");
  await expect(page.locator(".explore-card")).toHaveCount(1);
  expect(requests.length - before).toBe(1);
  expect(requests.at(-1)?.page_offset).toBe(0);
  await page.getByRole("searchbox").fill("");
  await page.getByLabel("Категория", { exact: true }).selectOption("Music");
  await expect(page.locator(".explore-card")).toHaveCount(8);
  await page.getByLabel("Сортировка").selectOption("random");
  await expect.poll(() => requests.at(-1)?.sort_order).toBe("random");
  await expect(
    page.getByRole("button", { name: "Перемешать страницы" }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("Нет таких");
  await expect(
    page.getByRole("heading", { name: "Ничего не найдено" }),
  ).toBeVisible();
  expect(media).toEqual([]);
});
test("cards navigate to real public route and report dialog is accessible without exposing contacts", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator(".explore-card")).toHaveCount(12);
  const trigger = page.getByRole("button", {
    name: "Сообщить о странице @artist_0",
  });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("после входа");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(
    page.locator("[data-username=artist_0] .explore-card-main"),
  ).toHaveAttribute("href", "/u/artist_0");
  const project = {
    ...emptyProject(),
    blocks: [{ ...newBlock("text"), content: "ПУБЛИЧНЫЙ МИР" }],
  };
  await page.route("**/rest/v1/published_pages*", (route) =>
    route.fulfill({ json: { project } }),
  );
  await page.locator("[data-username=artist_0] .explore-card-main").click();
  await expect(page).toHaveURL(/\/u\/artist_0$/);
  await expect(page.locator(".public-page")).toContainText("ПУБЛИЧНЫЙ МИР");
});
test("request failure/retry, safe text and cover fallback", async ({
  page,
}) => {
  const unsafe = {
    ...cards[0],
    title: "<img src=x onerror=alert(1)>",
    cover: "data:image/jpeg;base64,/9j/AP/Z",
  };
  await setup(page, [unsafe]);
  await expect(page.locator(".explore-card h2")).toHaveText(unsafe.title);
  await expect(page.locator(".explore-card h2 img")).toHaveCount(0);
  await expect(page.locator(".explore-cover-label")).toHaveText("БЕЗ ОБЛОЖКИ");
  await page.route("**/rest/v1/rpc/search_explore", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "private database internals" },
    }),
  );
  await page.getByLabel("Категория", { exact: true }).selectOption("Music");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("alert")).not.toContainText("private database");
  await page.route("**/rest/v1/rpc/search_explore", (route) =>
    route.fulfill({ json: { items: [], has_more: false, next_offset: 12 } }),
  );
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ничего не найдено" }),
  ).toBeVisible();
});
for (const width of [320, 390, 768, 1440])
  test(`gallery responsive ${width}px: touch controls, bounded layout, keyboard`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await setup(page);
    await expect(page.locator(".explore-card")).toHaveCount(12);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.getByRole("searchbox").focus();
    await expect(page.getByRole("searchbox")).toBeFocused();
    expect(
      (await page.getByRole("searchbox").boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    expect(
      (await page
        .getByRole("button", { name: "Сообщить о странице @artist_0" })
        .boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    if (width === 390 || width === 1440) {
      mkdirSync("docs/screenshots/explore", { recursive: true });
      await page.screenshot({
        path: `docs/screenshots/explore/gallery-${width}.png`,
        fullPage: false,
      });
    }
  });
