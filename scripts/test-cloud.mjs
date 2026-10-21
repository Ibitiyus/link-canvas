import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const raw = execFileSync(
  process.execPath,
  ["scripts/supabase.mjs", "status", "-o", "json"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const config = JSON.parse(
  raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
);
const url = config.API_URL,
  key = config.ANON_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url))
  throw new Error("Cloud integration tests are restricted to local Supabase.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, config.SERVICE_ROLE_KEY, options),
  anon = createClient(url, key, options);
const a = createClient(url, key, options),
  b = createClient(url, key, options);
const created = [];
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`PASS ${message}`);
}
function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
const effects = {
  animation: {
    enabled: true,
    type: "float",
    duration: 3,
    intensity: 0.5,
    delay: 0,
    repeat: "infinite",
    direction: "normal",
  },
  hover: "glow",
  visual: {
    glow: 4,
    shadow: 2,
    blur: 0,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    grayscale: 0,
  },
};
const page = (content = "Первая публикация") => ({
  version: 1,
  groups: [{ id: "cloud-group", name: "Облачный коллаж", effects }],
  page: {
    title: "Облачная проверка",
    background: "#112233",
    backgroundImage: "",
    columns: 4,
    gap: 16,
    maxWidth: 880,
    font: "mono",
  },
  blocks: [
    {
      id: "text-1",
      type: "text",
      name: "Заголовок",
      content,
      url: "",
      imageUrl: "",
      fit: "cover",
      background: "#ffffff",
      color: "#000000",
      radius: 12,
      opacity: 1,
      borderWidth: 0,
      borderColor: "#ff3355",
      fontSize: 24,
      align: "left",
      bold: true,
      col: 0,
      row: 0,
      colSpan: 2,
      rowSpan: 2,
      x: 24,
      y: 24,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: 1,
      locked: true,
      hidden: false,
      layer: 0,
      layout: "free",
      keepAspect: true,
      groupId: "cloud-group",
      effects,
    },
  ],
});
async function action(client, body) {
  const r = await client.functions.invoke("page-actions", { body });
  if (r.error) {
    let detail = "";
    if (r.error.context instanceof Response)
      detail = JSON.stringify(await r.error.context.json().catch(() => null));
    throw new Error(`Edge action ${body.action}: ${r.error.message} ${detail}`);
  }
  return r.data;
}
async function upload(client, uid, bytes, mime, ext) {
  const path = ok(
    await client.rpc("reserve_asset", {
      file_id: randomUUID(),
      extension: ext,
      content_type: mime,
      bytes: bytes.length,
    }),
    "reserve file",
  );
  ok(
    await client.storage
      .from("zin-drafts")
      .upload(path, bytes, { contentType: mime, upsert: false }),
    "upload file",
  );
  await action(client, { action: "complete-upload", path });
  return path;
}
try {
  const suffix = Date.now().toString(36),
    password = `Zin-${randomUUID()}-42`;
  const userA = ok(
    await a.auth.signUp({
      email: `zin-${suffix}-a@example.test`,
      password,
      options: { data: { username: `zin${suffix}a` } },
    }),
    "signup A",
  );
  assert.ok(userA.user);
  created.push(userA.user.id);
  const userB = ok(
    await b.auth.signUp({
      email: `zin-${suffix}-b@example.test`,
      password,
      options: { data: { username: `zin${suffix}b` } },
    }),
    "signup B",
  );
  assert.ok(userB.user);
  created.push(userB.user.id);
  check(
    !!userA.session && !!userB.session,
    "real Auth registration and sessions",
  );
  const uid = userA.user.id,
    other = userB.user.id;
  check(
    ok(await a.from("profiles").select("*"), "own profile").length === 1,
    "profile RLS exposes only the owner",
  );
  check(
    ok(await a.rpc("username_available", { value: "admin" }), "reserved") ===
      false,
    "reserved usernames rejected on server",
  );
  check(
    ok(
      await a.rpc("username_available", {
        value: userA.user.user_metadata.username,
      }),
      "taken",
    ) === false,
    "username uniqueness on server",
  );
  check(
    !!(
      await b.auth.signUp({
        email: `zin-${suffix}-collision@example.test`,
        password,
        options: { data: { username: userA.user.user_metadata.username } },
      })
    ).error,
    "duplicate username cannot create an account",
  );
  let draft = ok(
    await a.rpc("save_draft", { value: page(), expected_revision: 0 }),
    "create draft",
  );
  check(draft.revision === 1, "create actual PostgreSQL draft");
  check(
    draft.project.blocks[0].locked === true &&
      draft.project.blocks[0].hidden === false &&
      draft.project.blocks[0].layer === 0,
    "database round-trips lock, visibility and universal layer",
  );
  for (const [field, value] of [
    ["locked", "true"],
    ["hidden", 1],
    ["layer", -1],
    ["layer", 1.5],
    ["layer", "2"],
  ]) {
    const invalid = page();
    invalid.blocks[0][field] = value;
    check(
      !!(await a.rpc("save_draft", { value: invalid, expected_revision: 1 }))
        .error,
      `server rejects invalid editor field ${field}=${value}`,
    );
  }
  check(
    draft.project.groups?.[0]?.id === "cloud-group" &&
      draft.project.blocks[0].layout === "free" &&
      draft.project.blocks[0].groupId === "cloud-group",
    "PostgreSQL round-trips free canvas and group metadata",
  );
  for (const [field, value] of [
    ["layout", "absolute"],
    ["layout", "grid"],
    ["keepAspect", "yes"],
    ["groupId", "missing"],
    ["width", 0],
    ["rotation", 361],
  ]) {
    const invalid = page();
    invalid.blocks[0][field] = value;
    check(
      !!(await a.rpc("save_draft", { value: invalid, expected_revision: 1 }))
        .error,
      `server rejects invalid creative field ${field}=${value}`,
    );
  }
  const invalidGroups = page();
  invalidGroups.groups.push({ ...invalidGroups.groups[0] });
  check(
    !!(
      await a.rpc("save_draft", { value: invalidGroups, expected_revision: 1 })
    ).error,
    "server rejects duplicate group identifiers",
  );
  const legacy = page();
  delete legacy.groups;
  for (const b of legacy.blocks) {
    delete b.layout;
    delete b.keepAspect;
    delete b.groupId;
  }
  check(
    !(
      await admin.rpc("validate_project", {
        value: legacy,
        who: uid,
        published: false,
      })
    ).error,
    "server still accepts legacy grid projects",
  );
  const missingColumns = page();
  delete missingColumns.page.columns;
  check(
    !!(
      await a.rpc("save_draft", { value: missingColumns, expected_revision: 1 })
    ).error,
    "server rejects malformed project settings",
  );
  const duplicateIds = page();
  duplicateIds.blocks.push({ ...duplicateIds.blocks[0] });
  check(
    !!(await a.rpc("save_draft", { value: duplicateIds, expected_revision: 1 }))
      .error,
    "server rejects duplicate block IDs",
  );
  const unsafeLink = page();
  unsafeLink.blocks[0].type = "link";
  unsafeLink.blocks[0].url = "javascript:alert(1)";
  check(
    !!(await a.rpc("save_draft", { value: unsafeLink, expected_revision: 1 }))
      .error,
    "server rejects executable link protocols",
  );
  check(
    !!(await b.rpc("claim_unused_assets", { who: uid })).error,
    "server cleanup helper is inaccessible to users",
  );
  check(
    !!(await anon.from("drafts").select("*")).error,
    "anonymous access to drafts denied",
  );
  check(
    ok(await b.from("drafts").select("*").eq("owner_id", uid), "foreign draft")
      .length === 0,
    "another user cannot read private draft",
  );
  check(
    !!(
      await b
        .from("drafts")
        .update({ project: page("attack") })
        .eq("owner_id", uid)
    ).error,
    "direct foreign update denied",
  );
  check(
    !!(
      await b.from("published_pages").insert({
        owner_id: uid,
        username: "stolen",
        project: page(),
        source_revision: 1,
      })
    ).error,
    "client cannot forge a publication",
  );
  const simultaneous = await Promise.all([
    a.rpc("save_draft", { value: page("Версия 2"), expected_revision: 1 }),
    a.rpc("save_draft", { value: page("Версия 3"), expected_revision: 1 }),
  ]);
  check(
    simultaneous.filter((r) => !r.error).length === 1 &&
      simultaneous.filter((r) => r.error?.code === "40001").length === 1,
    "concurrent updates use revision CAS",
  );
  draft = ok(await a.from("drafts").select("*").single(), "read draft");
  const gif = readFileSync("tests/fixtures/animated.gif");
  const imagePath = await upload(a, uid, gif, "image/gif", "gif");
  check(
    !!(await anon.storage.from("zin-drafts").download(imagePath)).error,
    "anonymous private-file access denied",
  );
  check(
    !!(await b.storage.from("zin-drafts").download(imagePath)).error,
    "foreign private-file access denied",
  );
  check(
    !!(
      await a.storage
        .from("zin-drafts")
        .upload(imagePath, gif, { contentType: "image/gif", upsert: true })
    ).error,
    "verified files are immutable",
  );
  const font = readFileSync(
    "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
  );
  const fontPath = await upload(a, uid, font, "font/woff2", "woff2");
  const withFiles = page("Файлы и шрифт");
  withFiles.page.backgroundImage = `cloud:${imagePath}`;
  withFiles.customFonts = [
    { id: "local-font", name: "Мой шрифт", dataUrl: `cloud:${fontPath}` },
  ];
  withFiles.blocks[0].fontFamily = "font:local-font";
  draft = ok(
    await a.rpc("save_draft", {
      value: withFiles,
      expected_revision: draft.revision,
    }),
    "save files",
  );
  check(
    JSON.stringify(draft.project.blocks[0].effects) ===
      JSON.stringify(effects) ||
      draft.project.blocks[0].effects.animation.type === "float",
    "real cloud draft retains block animations",
  );
  for (const bad of [
    { animation: { ...effects.animation, duration: 0 } },
    { hover: "unsafe" },
    { visual: { ...effects.visual, blur: 99 } },
  ]) {
    const invalid = page();
    invalid.blocks[0].effects = bad;
    check(
      !!(
        await a.rpc("save_draft", {
          value: invalid,
          expected_revision: draft.revision,
        })
      ).error,
      "server rejects unsafe block effects",
    );
    const invalidGroup = page();
    invalidGroup.groups[0].effects = bad;
    check(
      !!(
        await a.rpc("save_draft", {
          value: invalidGroup,
          expected_revision: draft.revision,
        })
      ).error,
      "server rejects unsafe group effects",
    );
  }
  const attack = page();
  attack.page.backgroundImage = `cloud:${imagePath}`;
  check(
    !!(await b.rpc("save_draft", { value: attack, expected_revision: 0 }))
      .error,
    "server rejects references to another owner's assets",
  );
  const badPath = ok(
    await a.rpc("reserve_asset", {
      file_id: randomUUID(),
      extension: "png",
      content_type: "image/png",
      bytes: 23,
    }),
    "reserve invalid file",
  );
  ok(
    await a.storage
      .from("zin-drafts")
      .upload(badPath, Buffer.from("<html>not-image!!</html>"), {
        contentType: "image/png",
      }),
    "upload false MIME",
  );
  let rejected = false;
  try {
    await action(a, { action: "complete-upload", path: badPath });
  } catch {
    rejected = true;
  }
  check(rejected, "server checks actual file bytes, not just claimed MIME");
  check(
    !!(
      await a.storage
        .from("zin-public")
        .upload(`${uid}/attack.html`, Buffer.from("<script>x</script>"), {
          contentType: "text/html",
        })
    ).error,
    "clients cannot upload executable public content",
  );
  const lease = ok(
    await a.rpc("begin_publication", { expected_revision: draft.revision }),
    "publication lease",
  );
  check(
    !!(
      await a.rpc("finish_publication", {
        who: uid,
        job_token: lease.token,
        value: page(),
      })
    ).error,
    "client cannot finalize a public snapshot",
  );
  ok(await a.rpc("unpublish_page"), "cancel pending publication");
  check(
    !!(
      await admin.rpc("finish_publication", {
        who: uid,
        job_token: lease.token,
        value: page(),
      })
    ).error,
    "cancelled publication cannot finish after unpublish",
  );
  const published = (
    await action(a, { action: "publish", revision: draft.revision })
  ).page;
  const publicPage = ok(
    await anon
      .from("published_pages")
      .select("*")
      .eq("username", published.username)
      .single(),
    "public read",
  );
  check(
    publicPage.project.blocks[0].content === "Файлы и шрифт",
    "published page is readable without a session",
  );
  check(
    !JSON.stringify(publicPage.project).includes("cloud:"),
    "published snapshots contain no private file references",
  );
  check(
    publicPage.project.groups?.[0]?.id === "cloud-group" &&
      publicPage.project.blocks[0].groupId === "cloud-group" &&
      publicPage.project.blocks[0].layout === "free",
    "publication retains real free geometry and group metadata",
  );
  check(
    publicPage.project.blocks[0].effects.animation.type === "float" &&
      publicPage.project.groups[0].effects.hover === "glow",
    "public snapshot preserves block and group effects",
  );
  const media = await fetch(publicPage.project.page.backgroundImage);
  check(
    media.ok && Buffer.from(await media.arrayBuffer()).equals(gif),
    "public image bytes are available from another client",
  );
  const publicFont = await fetch(publicPage.project.customFonts[0].dataUrl);
  check(
    publicFont.ok && Buffer.from(await publicFont.arrayBuffer()).equals(font),
    "custom fonts publish as real Storage files",
  );
  draft = ok(
    await a.rpc("save_draft", {
      value: page("Новый приватный черновик"),
      expected_revision: draft.revision,
    }),
    "edit private",
  );
  check(
    ok(
      await anon
        .from("published_pages")
        .select("*")
        .eq("username", published.username)
        .single(),
      "unchanged public",
    ).project.blocks[0].content === "Файлы и шрифт",
    "editing a draft does not modify publication",
  );
  const renamed = `zin${suffix}new`;
  ok(await a.rpc("rename_username", { value: renamed }), "rename");
  check(
    ok(
      await anon
        .from("published_pages")
        .select("*")
        .eq("username", published.username),
      "old address",
    ).length === 0,
    "old username stops resolving",
  );
  check(
    ok(
      await anon.from("published_pages").select("*").eq("username", renamed),
      "new address",
    ).length === 1,
    "rename atomically updates public address",
  );
  const republished = (
    await action(a, { action: "publish", revision: draft.revision })
  ).page;
  check(
    republished.project.blocks[0].content === "Новый приватный черновик",
    "republish updates only after explicit action",
  );
  const recovery = ok(
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: userA.user.email,
    }),
    "recovery link",
  );
  const recovered = createClient(url, key, options);
  ok(
    await recovered.auth.verifyOtp({
      token_hash: recovery.properties.hashed_token,
      type: "recovery",
    }),
    "verify recovery",
  );
  const newPassword = `New-${randomUUID()}-42`;
  ok(
    await recovered.auth.updateUser({ password: newPassword }),
    "change password",
  );
  const relog = createClient(url, key, options);
  check(
    !!ok(
      await relog.auth.signInWithPassword({
        email: userA.user.email,
        password: newPassword,
      }),
      "new password",
    ).session,
    "Auth password recovery and sign-in with the new password",
  );
  ok(
    await a.auth.signInWithPassword({
      email: userA.user.email,
      password: newPassword,
    }),
    "refresh session after password reset",
  );
  ok(await a.rpc("unpublish_page"), "unpublish");
  check(
    ok(
      await anon.from("published_pages").select("*").eq("username", renamed),
      "unpublished",
    ).length === 0,
    "unpublishing removes anonymous page access",
  );
  const stale = new Date(Date.now() - 8 * 86400000).toISOString();
  ok(
    await admin
      .from("assets")
      .update({ created_at: stale })
      .eq("owner_id", uid),
    "age unused files",
  );
  const cleanup = await action(a, { action: "cleanup" });
  check(cleanup.removed >= 2, "safe cleanup removes old unreferenced files");
  check(
    ok(await a.from("drafts").select("*").single(), "remaining draft").project
      .blocks[0].content === "Новый приватный черновик",
    "cleanup preserves current draft",
  );
  ok(await a.auth.signOut({ scope: "local" }), "logout");
  check(
    !(await a.auth.getSession()).data.session,
    "sign-out clears the session",
  );
  console.log(
    `Cloud integration: ${checks} checks passed against local Supabase.`,
  );
} finally {
  // Only accounts created by this run, on the loopback-only stack.
  for (const id of created) {
    const { data: folders } = await admin.storage
      .from("zin-public")
      .list(id, { limit: 1000 });
    for (const folder of folders ?? []) {
      if (folder.id) continue;
      const prefix = `${id}/${folder.name}`;
      const { data: files } = await admin.storage
        .from("zin-public")
        .list(prefix, { limit: 1000 });
      if (files?.length)
        await admin.storage
          .from("zin-public")
          .remove(files.map((f) => `${prefix}/${f.name}`));
    }
    const { data: files } = await admin.storage
      .from("zin-drafts")
      .list(id, { limit: 1000 });
    if (files?.length)
      await admin.storage
        .from("zin-drafts")
        .remove(files.map((f) => `${id}/${f.name}`));
    await admin.auth.admin.deleteUser(id);
  }
}
