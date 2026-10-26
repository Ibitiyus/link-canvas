import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const cover =
  "data:image/jpeg;base64," +
  readFileSync("tests/fixtures/explore-cover.jpg").toString("base64");
const cards = Array.from({ length: 4 }, (_, i) => ({
  username: `real_author_${i}`,
  title: `Страница автора ${i}`,
  description: "Реальная подборка из Explore",
  category: "Art & Design",
  cover: i === 1 ? "" : cover,
  listed_at: "2026-10-25T00:00:00Z",
  updated_at: "2026-10-25T00:00:00Z",
}));
for (const width of [320, 390, 768, 1440]) {
  test(`Explore landing ${width}: real pages, SVG arrows and decoded author covers`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route("**/rest/v1/rpc/search_explore", (route) =>
      route.fulfill({
        json: { items: cards, has_more: false, next_offset: 4 },
      }),
    );
    await page.goto("/");
    const samples = page.locator(".riot-sample");
    await expect(samples).toHaveCount(3);
    await expect(samples.first()).toHaveAttribute("href", "/u/real_author_0");
    await expect(page.locator('.raw-home a[href^="/templates"]')).toHaveCount(
      0,
    );
    await expect(page.locator(".raw-templates")).toHaveCount(0);
    await expect(
      samples.first().locator("svg.service-arrow").first(),
    ).toBeAttached();
    expect(
      await page
        .locator(".raw-nav,.riot-samples,.raw-footer")
        .allTextContents(),
    ).not.toEqual(expect.arrayContaining([expect.stringContaining("↗")]));
    for (const card of await samples.all()) {
      const geometry = await card.evaluate((el) => ({
        card: el.clientWidth,
        cover: (el.querySelector(".explore-cover") as HTMLElement).offsetWidth,
      }));
      expect(geometry.cover).toBeLessThanOrEqual(geometry.card);
    }
    const img = samples.first().locator("img");
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(samples.nth(1).locator(".explore-type-cover")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("home gallery uses real empty/error states and recovers on retry", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/rest/v1/rpc/search_explore", (route) =>
    failed
      ? route.fulfill({ status: 503, json: { message: "Unavailable" } })
      : route.fulfill({ json: { items: [], has_more: false, next_offset: 0 } }),
  );
  await page.goto("/");
  await expect(page.getByText("Подборка временно недоступна.")).toBeVisible();
  failed = false;
  await page
    .locator(".home-gallery-message")
    .getByRole("button", { name: "Повторить" })
    .click();
  await expect(
    page.getByText(
      "Здесь появятся страницы, авторы которых поделились ими в Explore.",
    ),
  ).toBeVisible();
  await expect(page.locator(".riot-sample")).toHaveCount(0);
});
test("a broken JPEG is replaced with typography instead of a broken-image icon", async ({
  page,
}) => {
  const invalidCover =
    "data:image/jpeg;base64," +
    Buffer.from([255, 216, 255, 0, 255, 217]).toString("base64");
  await page.route("**/rest/v1/rpc/search_explore", (route) =>
    route.fulfill({
      json: {
        items: [{ ...cards[0], cover: invalidCover }],
        has_more: false,
        next_offset: 1,
      },
    }),
  );
  await page.goto("/");
  const card = page.locator(".riot-sample");
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".explore-type-cover")).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0);
});
