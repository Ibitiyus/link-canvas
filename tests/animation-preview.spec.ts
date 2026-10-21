import { test, expect } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import { DEFAULT_ANIMATION } from "../src/model/effects";
test("switching temporary preview targets stops the previous effect without remounting contents", async ({
  page,
}) => {
  const p = {
    ...emptyProject(),
    blocks: [
      {
        ...newBlock("text"),
        id: "first",
        col: 0,
        effects: {
          animation: { ...DEFAULT_ANIMATION, type: "float", duration: 30 },
        },
      },
      {
        ...newBlock("text"),
        id: "second",
        col: 2,
        effects: {
          animation: { ...DEFAULT_ANIMATION, type: "spin", duration: 30 },
        },
      },
    ],
  };
  await page.addInitScript(
    (p) => localStorage.setItem("link-canvas.project.v1", JSON.stringify(p)),
    p,
  );
  await page.goto("/editor");
  await page.locator('[data-block-id="first"]').click();
  await page.getByText("Анимация и эффекты", { exact: true }).click();
  const first = page.locator('[data-block-id="first"] .effect-animation'),
    second = page.locator('[data-block-id="second"] .effect-animation'),
    content = await page
      .locator('[data-block-id="first"] .block-content')
      .elementHandle();
  await page
    .getByRole("button", { name: "Воспроизвести анимацию", exact: true })
    .click();
  await expect(first).toHaveCSS("animation-name", "zin-float");
  await page.locator('[data-block-id="second"]').click();
  await page.getByText("Анимация и эффекты", { exact: true }).click();
  await page
    .getByRole("button", { name: "Воспроизвести анимацию", exact: true })
    .click();
  await expect(second).toHaveCSS("animation-name", "zin-spin");
  await expect(first).toHaveCSS("animation-name", "none");
  expect(await content!.evaluate((e) => e.isConnected)).toBe(true);
});
