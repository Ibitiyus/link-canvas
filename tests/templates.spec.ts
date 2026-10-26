import { test, expect } from "@playwright/test";
import { demoProject } from "../src/model/defaults";

for (const width of [320, 390, 768, 1440]) {
  test(`empty templates tab at ${width}px preserves the existing draft`, async ({
    page,
  }) => {
    const project = demoProject();
    await page.addInitScript(
      (project) =>
        localStorage.setItem("link-canvas.project.v1", JSON.stringify(project)),
      project,
    );
    await page.setViewportSize({ width, height: 900 });
    const previewRequests: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/templates/previews/"))
        previewRequests.push(r.url());
    });
    await page.goto("/templates");
    await expect(page.getByText("Пока здесь пусто.")).toBeVisible();
    await expect(page.locator(".template-card,.template-filters")).toHaveCount(
      0,
    );
    expect(previewRequests).toEqual([]);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("link-canvas.project.v1")!),
      ),
    ).toEqual(project);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "Создать свой ZIN", exact: true })
      .click();
    await expect(page.locator(".editor-toolbar")).toBeVisible();
  });
}
test("old template URLs remain readable without listing templates in the tab", async ({
  page,
}) => {
  await page.goto("/templates/punk-zine");
  await expect(page.locator(".template-preview .canvas")).toBeVisible();
  await expect(page.locator(".effect-group")).toHaveCount(1);
});
