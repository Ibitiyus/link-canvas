import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:5180",
    viewport: { width: 1440, height: 1000 },
    launchOptions: { executablePath },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      process.env.TEST_PRODUCTION === "1"
        ? "npm run preview -- --port 5180"
        : "npm run dev -- --port 5180",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
