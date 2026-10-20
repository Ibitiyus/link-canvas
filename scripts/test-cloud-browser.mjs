import { execFileSync, spawnSync } from "node:child_process";
const raw = execFileSync(
  process.execPath,
  ["scripts/supabase.mjs", "status", "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const config = JSON.parse(
  raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(config.API_URL))
  throw new Error("Browser cloud tests are restricted to local Supabase.");
const env = {
  ...process.env,
  ZIN_CLOUD_E2E: "1",
  TEST_PRODUCTION: "1",
  VITE_SUPABASE_URL: config.API_URL,
  VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
  ZIN_TEST_SERVICE_KEY: config.SERVICE_ROLE_KEY,
  ZIN_TEST_MAILPIT_URL: config.MAILPIT_URL,
};
let result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  { stdio: "inherit", env },
);
if (result.status !== 0) process.exit(result.status ?? 1);
result = spawnSync(
  process.execPath,
  [
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/cloud-platform.spec.ts",
    "--workers=1",
  ],
  { stdio: "inherit", env },
);
process.exitCode = result.status ?? 1;
