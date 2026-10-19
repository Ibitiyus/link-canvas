import { test, expect, type Page } from "@playwright/test";
import { demoProject } from "../src/model/defaults";
import type { Project } from "../src/model/types";
const KEY = "link-canvas.project.v1";
async function project(page: Page): Promise<Project> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function add(page: Page, type: string) {
  await page
    .getByRole("button", { name: `Добавить: ${type}`, exact: true })
    .click();
}
test("HTTP LAN compatibility when crypto.randomUUID is unavailable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(Crypto.prototype, "randomUUID", {
      value: undefined,
      configurable: true,
    }),
  );
  await page.goto("/editor");
  await add(page, "Текст");
  await page
    .getByRole("button", { name: "Дублировать блок", exact: true })
    .click();
  await expect.poll(async () => (await project(page)).blocks.length).toBe(6);
  await page.reload();
  await expect(page.locator("[data-block-id]")).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("a render failure shows recovery actions instead of a black page", async ({
  page,
}) => {
  const saved = demoProject();
  await page.addInitScript(
    ({ key, saved }) => {
      localStorage.setItem(key, JSON.stringify(saved));
      Object.defineProperty(Crypto.prototype, "randomUUID", {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(Crypto.prototype, "getRandomValues", {
        value: () => {
          throw new Error("Forced render failure");
        },
        configurable: true,
      });
    },
    { key: KEY, saved },
  );
  await page.goto("/editor");
  await expect(
    page.getByRole("heading", {
      name: "Не удалось открыть приложение",
      exact: true,
    }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Сохранить резервную копию", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("zin-recovery.json");
  expect(await project(page)).toEqual(saved);
});
