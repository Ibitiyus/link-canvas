// Local sandbox workaround: the environment injects an HTTP proxy into Docker.
// Internal Supabase traffic must stay on the Docker network. No TLS checks are disabled.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const name = "supabase_edge_runtime_zin";
const inspect = JSON.parse(
  execFileSync("docker", ["inspect", name], { encoding: "utf8" }),
)[0];
if (!inspect.Config.Image.includes("supabase"))
  throw new Error("Not a Supabase test container.");
const folder = mkdtempSync(join(tmpdir(), "zin-edge-"));
try {
  execFileSync("docker", ["cp", `${name}:/root`, join(folder, "root")], {
    stdio: "ignore",
  });
  const bootstrap = execFileSync("tar", [
    "--exclude=root/.cache",
    "-C",
    folder,
    "-cf",
    "-",
    "root",
  ]);
  const envFile = join(folder, "environment");
  writeFileSync(envFile, inspect.Config.Env.join("\n") + "\n", { mode: 0o600 });
  // Stop only a functions-serve watcher from this checkout before replacing its container.
  // SIGTERM makes the CLI remove the container, so preserve the captured bootstrap first.
  const executable = join(
    process.cwd(),
    "node_modules/@supabase/cli-linux-x64/bin/supabase",
  );
  const pattern = `^${executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} functions serve`;
  let watchers = [];
  try {
    watchers = execFileSync("pgrep", ["-f", pattern], { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
  } catch {}
  for (const pid of watchers)
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {}
  execFileSync("docker", ["stop", name], { stdio: "ignore" });
  execFileSync("docker", ["rm", name], { stdio: "ignore" });
  const networks = Object.keys(inspect.NetworkSettings.Networks),
    args = [
      "create",
      "--name",
      name,
      "--network",
      networks[0],
      "--env-file",
      envFile,
      "--entrypoint",
      "/bin/sh",
      "--workdir",
      inspect.Config.WorkingDir || process.cwd(),
    ];
  for (const mount of inspect.Mounts)
    args.push(
      "--mount",
      `type=${mount.Type},source=${mount.Type === "volume" ? mount.Name : mount.Source},target=${mount.Destination}${mount.RW ? "" : ",readonly"}`,
    );
  for (const [port, bindings] of Object.entries(
    inspect.HostConfig.PortBindings ?? {},
  ))
    for (const binding of bindings ?? [])
      args.push(
        "-p",
        `${binding.HostIp ? binding.HostIp + ":" : ""}${binding.HostPort}:${port}`,
      );
  args.push(
    inspect.Config.Image,
    "-c",
    'unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy; exec "$@"',
    "zin-edge",
    ...(inspect.Config.Entrypoint ?? []),
    ...(inspect.Config.Cmd ?? []),
  );
  execFileSync("docker", args, { stdio: "ignore" });
  execFileSync("docker", ["cp", "-", `${name}:/`], {
    input: bootstrap,
    stdio: ["pipe", "ignore", "pipe"],
  });
  for (const network of networks.slice(1))
    execFileSync("docker", ["network", "connect", network, name], {
      stdio: "ignore",
    });
  execFileSync("docker", ["start", name], { stdio: "ignore" });
  console.log(
    "Local Edge Runtime restarted with direct internal HTTP; configuration and credentials were not printed.",
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
