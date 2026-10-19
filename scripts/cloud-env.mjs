import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
// Local CLI-generated test credentials only. Never writes service_role to a VITE variable.
const raw = execFileSync(
  process.execPath,
  ["scripts/supabase.mjs", "status", "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const start = raw.indexOf("{"),
  end = raw.lastIndexOf("}");
const values = JSON.parse(raw.slice(start, end + 1));
const api = values.API_URL ?? values.api_url;
const key = values.ANON_KEY ?? values.anon_key;
if (!api || !key)
  throw new Error(
    "Local Supabase API URL or anon key missing. Run cloud:start first.",
  );
if (!/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(api))
  throw new Error("Refusing to write configuration for a remote project.");
writeFileSync(
  resolve(".env.local"),
  `VITE_SUPABASE_URL=${api}\nVITE_SUPABASE_ANON_KEY=${key}\nVITE_CLOUD_MAX_FILE_MB=50\n`,
);
writeFileSync(
  resolve("supabase/functions/.env"),
  `ZIN_PUBLIC_SUPABASE_URL=${api}\n`,
);
console.log(
  "Local browser configuration written to ignored .env.local; keys were not printed. Restart Vite after changing it.",
);
