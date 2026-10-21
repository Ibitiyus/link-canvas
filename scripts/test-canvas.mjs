import { spawnSync } from "node:child_process";
// Deliberately fake, local-only configuration: public-page HTTP is fulfilled by Playwright.
const env = {
  ...process.env,
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
  VITE_SUPABASE_ANON_KEY: "zin-local-renderer-test",
  TEST_PRODUCTION: "1",
  ZIN_CANVAS_E2E: "1",
};
for (const args of [
  ["node_modules/vite/bin/vite.js", "build"],
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/canvas-scaling.spec.ts",
    "tests/editor-controls.spec.ts",
    "tests/creative-tools.spec.ts",
    "tests/animations.spec.ts",
    "tests/animation-preview.spec.ts",
    ...process.argv.slice(2),
  ],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", env });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
