import { spawn } from "node:child_process";
import { resolve } from "node:path";
// The CLI's documented SUPABASE_HOME supports read-only cloud home directories.
const child = spawn(
  process.execPath,
  [resolve("node_modules/supabase/dist/supabase.js"), ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      SUPABASE_HOME:
        process.env.SUPABASE_HOME ??
        resolve("node_modules/.cache/zin-supabase"),
      SUPABASE_USE_SLIM_IMAGES: process.env.SUPABASE_USE_SLIM_IMAGES ?? "true",
    },
  },
);
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
