import { defineConfig } from "vite";

export default defineConfig(({ command }) => {
  // Keep development and preview deployments self-contained. Production can
  // deliver static files through its working Vercel alias while retaining the
  // custom domain for navigation, local projects and authentication.
  let base = "/";
  if (command === "build" && process.env.VERCEL_ENV === "production") {
    const value = process.env.ZIN_ASSET_ORIGIN;
    if (value) {
      const origin = new URL(value);
      if (
        origin.protocol !== "https:" || origin.username || origin.password ||
        origin.pathname !== "/" || origin.search || origin.hash
      ) throw new Error("ZIN_ASSET_ORIGIN must be a plain HTTPS origin");
      base = origin.origin + "/";
    }
  }
  return { base };
});
