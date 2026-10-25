import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";

const origin = process.env.ZIN_TEST_ASSET_ORIGIN;
test.skip(!origin, "Requires a production build with a separate asset origin");

for (const width of [390, 1440]) {
  test(`separate static origin preserves navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const requested: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Emulate the exact same deployment on the Vercel asset alias, without
    // depending on which revision is currently live in production.
    await page.route(`${origin}/assets/**`, async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const root = resolve("dist/assets");
      const file = resolve("dist", "." + pathname);
      if (!file.startsWith(root + "/")) return route.abort();
      requested.push(pathname);
      const types: Record<string, string> = {
        ".js": "application/javascript", ".css": "text/css",
        ".woff2": "font/woff2", ".woff": "font/woff", ".svg": "image/svg+xml",
      };
      await route.fulfill({
        body: await readFile(file),
        contentType: types[extname(file)] || "application/octet-stream",
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    });
    const localAssets: string[] = [];
    page.on("request", (r) => {
      if (r.url().startsWith("http://127.0.0.1:5180/assets/")) localAssets.push(r.url());
    });
    await page.goto("/");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/editor");
    await expect(page.locator(".editor-shell")).toBeVisible();
    await page.goto("/templates");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(requested.some((p) => p.endsWith(".js"))).toBe(true);
    expect(requested.some((p) => p.endsWith(".css"))).toBe(true);
    expect(requested.some((p) => p.endsWith(".woff2"))).toBe(true);
    expect(localAssets).toEqual([]);
    expect(errors).toEqual([]);
  });
}
