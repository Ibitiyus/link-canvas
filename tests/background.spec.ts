import { test, expect } from "@playwright/test";
import { emptyProject, newBlock } from "../src/model/defaults";
import type { BlockType } from "../src/model/types";
import { readFileSync } from "node:fs";
test("all eight block backgrounds support independent alpha, color changes, reload and preview", async ({
  page,
}) => {
  const project = emptyProject();
  project.blocks = (
    [
      "link",
      "text",
      "image",
      "gif",
      "video",
      "audio",
      "qrcode",
      "decoration",
    ] as BlockType[]
  ).map((type) => ({
    ...newBlock(type),
    id: type,
    name: type,
    background: "#123456",
    opacity: 0.75,
    ...(type === "video"
      ? { url: "https://media.zin.test/test.webm", fit: "contain" as const }
      : {}),
  }));
  await page.addInitScript((p) => {
    if (!localStorage.getItem("link-canvas.project.v1"))
      localStorage.setItem("link-canvas.project.v1", JSON.stringify(p));
  }, project);
  await page.route("https://media.zin.test/test.webm", (route) =>
    route.fulfill({
      contentType: "video/webm",
      body: readFileSync("tests/fixtures/clip.webm"),
    }),
  );
  await page.goto("/editor");
  await page.getByRole("button", { name: "Слои 8", exact: true }).click();
  for (const block of project.blocks) {
    await page.locator(".layer-select").filter({ hasText: block.name }).click();
    await page.getByLabel("Прозрачность фона, %", { exact: true }).fill("50");
    await page.getByLabel("Фон блока", { exact: true }).fill("#abcdef");
    const content = page.locator(
      `[data-block-id="${block.id}"] .block-content`,
    );
    await expect(content).toHaveCSS(
      "background-color",
      /rgba\(171, 205, 239, 0\.5(?:02)?\)/,
    );
    await expect(content).toHaveCSS("opacity", "0.75");
    await page.getByLabel("Прозрачный фон", { exact: true }).check();
    await expect(content).toHaveCSS(
      "background-color",
      "rgba(171, 205, 239, 0)",
    );
    await page.getByLabel("Прозрачный фон", { exact: true }).uncheck();
    await expect(content).toHaveCSS("background-color", "rgb(171, 205, 239)");
    await page
      .getByLabel("Ползунок прозрачности фона", { exact: true })
      .fill("50");
  }
  await expect(
    page.getByRole("button", { name: "Сохранено", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  for (const block of project.blocks) {
    const content = page.locator(
      `[data-block-id="${block.id}"] .block-content`,
    );
    await expect(content).toHaveCSS(
      "background-color",
      /rgba\(171, 205, 239, 0\.5(?:02)?\)/,
    );
    await expect(content).toHaveCSS("opacity", "0.75");
  }
  await expect(page.locator("video")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(page.locator(".qr-code rect")).toHaveCount(0);
});
