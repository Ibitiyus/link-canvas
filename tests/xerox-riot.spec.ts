import { test, expect } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
for (const width of [320, 390, 768, 1440]) {
  test(`XEROX RIOT ${width}: paper landing and accessible auth modes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".riot-collage img")).toHaveCount(3);
    await expect(page.locator(".riot-sample")).toHaveCount(3);
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName(
      "САЙТ НЕ ОБЯЗАН БЫТЬ НОРМАЛЬНЫМ.",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const route of [
      "login",
      "register",
      "forgot-password",
      "reset-password",
    ]) {
      await page.goto(`/${route}`);
      await expect(page.locator(".auth-card")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const input = page.locator(".auth-card input").first();
      await expect(input).toBeVisible();
      await input.fill(
        route === "reset-password"
          ? "test-password"
          : route === "register"
            ? "example"
            : "test@example.com",
      );
      await expect(page.locator(".auth-links a").first()).toHaveAttribute(
        "href",
        /\/login/,
      );
    }
  });
}
test("zoomed light grid keeps a physical stroke and never enters preview", async ({
  page,
}) => {
  const project = emptyProject();
  project.page.background = "#fbf9f3";
  project.blocks = [
    {
      ...newBlock("text"),
      id: "paper-block",
      content: "Авторский текст",
      background: "#89abcdef",
      radius: 21,
    },
  ];
  await page.addInitScript(
    (project) =>
      localStorage.setItem("link-canvas.project.v1", JSON.stringify(project)),
    project,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/editor");
  const cell = page.locator(".workspace .grid-cell").first();
  await expect(cell).toHaveCSS("border-top-style", "solid");
  const stroke = await cell.evaluate((element) => {
    const style = getComputedStyle(element);
    return (
      parseFloat(style.borderTopWidth) *
      parseFloat(style.getPropertyValue("--canvas-scale"))
    );
  });
  expect(stroke).toBeGreaterThan(0.65);
  expect(stroke).toBeLessThan(1.35);
  await page.getByLabel("Видимость сетки").selectOption("hidden");
  await expect(cell).toHaveCSS("visibility", "hidden");
  await page.getByLabel("Видимость сетки").selectOption("auto");
  await expect(cell).toHaveCSS("visibility", "visible");
  await page.locator('[data-block-id="paper-block"]').click();
  await page.getByRole("button", { name: "Изменить", exact: true }).click();
  await expect(
    page.getByLabel("Название блока", { exact: true }),
  ).toBeInViewport();
  const visibleComposition = await page.evaluate(() => {
    const block = document
      .querySelector('[data-block-id="paper-block"]')!
      .getBoundingClientRect();
    const sheet = document
      .querySelector(".mobile-sheet")!
      .getBoundingClientRect();
    return Math.min(block.bottom, sheet.top) - block.top;
  });
  expect(visibleComposition).toBeGreaterThan(0);
  await page.goto("/preview");
  await expect(page.locator(".grid-cell")).toHaveCount(0);
  await expect(page.locator(".block-content")).toHaveCSS(
    "border-radius",
    "21px",
  );
});
