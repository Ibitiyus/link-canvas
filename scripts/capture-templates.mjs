import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
});
const page = await browser.newPage({
  viewport: { width: 1100, height: 1200 },
  reducedMotion: "reduce",
});
mkdirSync("/tmp/zin-template-captures", { recursive: true });
for (const id of [
  "cybercore",
  "punk-zine",
  "old-web",
  "minimal-brutalism",
  "music-artist",
  "photographer",
  "gaming-profile",
  "blank-canvas",
]) {
  await page.goto(`http://127.0.0.1:4173/templates/${id}`);
  await page.locator(".canvas-extent").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.all(
      [...document.images].map((im) => im.decode().catch(() => {})),
    );
    await Promise.all(
      [...document.querySelectorAll("video")].map((v) =>
        v.readyState >= 2
          ? Promise.resolve()
          : new Promise((resolve) => {
              v.addEventListener("loadeddata", resolve, { once: true });
              setTimeout(resolve, 2000);
            }),
      ),
    );
  });
  await page
    .locator(".canvas-extent")
    .screenshot({ path: `/tmp/zin-template-captures/${id}.png` });
}
await browser.close();
