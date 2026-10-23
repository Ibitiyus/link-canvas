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
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(config.API_URL))
  throw new Error("Explore tests only permit local Supabase.");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  anon = createClient(config.API_URL, config.ANON_KEY, options);
const users = [];
let checks = 0;
const ok = (result, label = "request") => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const check = (condition, label) => {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
};
const project = {
  version: 1,
  page: {
    title: "Original published ZIN",
    background: "#111111",
    backgroundImage: "",
    columns: 4,
    gap: 16,
    maxWidth: 960,
    font: "mono",
  },
  blocks: [],
};
const search = async (args = {}) =>
  ok(await anon.rpc("search_explore", args), "search");
const settings = async (
  client,
  title = "Public art",
  publish = true,
  extra = {},
) =>
  ok(
    await client.rpc("save_explore_settings", {
      new_title: title,
      new_description: "Independent drawing worlds",
      new_category: "Art & Design",
      new_cover: "",
      publish_now: publish,
      ...extra,
    }),
    "settings",
  );
async function user(index) {
  const username = `expl${Date.now().toString(36)}${index}`,
    email = `${username}@example.test`,
    password = `Zin-${randomUUID()}!`;
  const { user } = ok(
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username },
    }),
    "create user",
  );
  users.push(user.id);
  const client = createClient(config.API_URL, config.ANON_KEY, options);
  ok(await client.auth.signInWithPassword({ email, password }), "login");
  return { id: user.id, username, client };
}
try {
  const a = await user(0),
    b = await user(1);
  check(
    (await search()).items.length === 0,
    "anonymous empty gallery; no invented entries",
  );
  ok(
    await a.client.rpc("save_draft", { value: project, expected_revision: 0 }),
    "draft",
  );
  const publication = await a.client.functions.invoke("page-actions", {
    body: { action: "publish", revision: 1 },
  });
  if (publication.error?.context instanceof Response)
    console.log("Publication response", await publication.error.context.json());
  ok(publication, "actual Edge publication");
  check(
    (await search()).items.length === 0,
    "old/new publication never opts in automatically",
  );
  check(
    !(
      await anon
        .from("published_pages")
        .select("username")
        .eq("username", a.username)
    ).error,
    "direct public link exists independently of Explore",
  );
  ok(await a.client.rpc("set_explore_visibility", { visible: true }));
  let result = await search();
  check(
    result.items[0]?.title === "Original published ZIN",
    "explicit opt-in caches existing published title",
  );
  check(
    !JSON.stringify(result).includes("owner_id") &&
      !JSON.stringify(result).includes("project") &&
      !JSON.stringify(result).includes("@example.test"),
    "public projection has no project/private ID/email",
  );
  await settings(a.client);
  check(
    (await search({ search_text: "art" })).items.length === 1,
    "published title is searchable",
  );
  check(
    (await search({ search_text: "drawing" })).items.length === 1,
    "published description is searchable",
  );
  check(
    (await search({ search_text: a.username })).items.length === 1,
    "username is searchable",
  );
  check(
    (await search({ category_filter: "Music" })).items.length === 0,
    "category filtering",
  );
  check(
    (await search({ search_text: "%" })).items.length === 0,
    "SQL LIKE wildcard is literal",
  );
  await settings(a.client, "PRIVATE NEXT TITLE", false);
  check(
    (await search({ search_text: "PRIVATE NEXT" })).items.length === 0,
    "draft metadata never leaks into search",
  );
  check(
    (await search({ search_text: "Public art" })).items.length === 1,
    "previous metadata snapshot remains published",
  );
  // Username cascade must not publish pending metadata.
  const renamed = `${a.username}new`;
  ok(await a.client.rpc("rename_username", { value: renamed }));
  result = await search();
  check(
    result.items[0].username === renamed &&
      result.items[0].title === "Public art",
    "username is current without publishing pending metadata",
  );
  check(
    ok(
      await anon
        .from("published_pages")
        .select("username")
        .eq("username", renamed),
    ).length === 1,
    "renamed direct public route is available",
  );
  check(
    ok(await b.client.from("explore_settings").select("*").eq("owner_id", a.id))
      .length === 0,
    "RLS denies reading another owner private settings",
  );
  check(
    !!(
      await b.client
        .from("explore_settings")
        .update({ title: "hacked" })
        .eq("owner_id", a.id)
    ).error,
    "table grants prohibit cross-owner mutation",
  );
  check(
    !!(await anon.rpc("set_explore_visibility", { visible: true })).error,
    "anonymous cannot consent for an author",
  );
  check(
    !!(
      await a.client.rpc("moderate_explore", {
        page_username: renamed,
        hide: false,
      })
    ).error,
    "owner cannot invoke privileged moderation RPC",
  );
  check(
    !!(await anon.from("explore_settings").select("*")).error,
    "anonymous cannot list private settings",
  );
  ok(
    await a.client.functions.invoke("page-actions", {
      body: { action: "publish", revision: 1 },
    }),
  );
  check(
    (await search()).items[0].title === "PRIVATE NEXT TITLE",
    "idempotent page republication snapshots pending metadata",
  );
  const fakeJpeg =
    "data:image/jpeg;base64," +
    Buffer.from([255, 216, 255, 0, 255, 217]).toString("base64");
  check(
    !!(
      await a.client.rpc("save_explore_settings", {
        new_title: "Fine",
        new_description: "",
        new_category: "Other",
        new_cover: fakeJpeg,
      })
    ).error,
    "server rejects fake JPEG header without bounded dimensions",
  );
  const thumbnail =
    "data:image/jpeg;base64," +
    readFileSync("tests/fixtures/explore-cover.jpg").toString("base64");
  const largeBytes = Buffer.from(thumbnail.slice(23), "base64");
  let sof = -1;
  for (let j = 0; j < largeBytes.length - 8; j++)
    if (largeBytes[j] === 255 && [192, 193, 194].includes(largeBytes[j + 1])) {
      sof = j;
      break;
    }
  assert.ok(sof >= 0);
  largeBytes[sof + 7] = 255;
  largeBytes[sof + 8] = 255;
  check(
    !!(
      await a.client.rpc("save_explore_settings", {
        new_title: "Fine",
        new_description: "",
        new_category: "Other",
        new_cover: "data:image/jpeg;base64," + largeBytes.toString("base64"),
      })
    ).error,
    "server rejects decompression-bomb thumbnail dimensions",
  );
  await settings(a.client, "PRIVATE NEXT TITLE", false, {
    new_cover: thumbnail,
  });
  check((await search()).items[0].cover === "", "draft cover remains private");
  await settings(a.client, "PRIVATE NEXT TITLE", true, {
    new_cover: thumbnail,
  });
  check(
    (await search()).items[0].cover === thumbnail,
    "explicit publication exposes only the bounded JPEG thumbnail",
  );
  check(
    !!(
      await settings(a.client, "bad", true, {
        new_cover: "data:image/svg+xml;base64,PHN2Zz4=",
      })
        .then(() => null)
        .catch((e) => e)
    ).message,
    "SVG cover rejected by server",
  );
  check(
    !!(
      await a.client.rpc("save_explore_settings", {
        new_title: "a".repeat(81),
        new_description: "",
        new_category: "Other",
        new_cover: "",
      })
    ).error,
    "server enforces title limit",
  );
  check(
    !!(
      await a.client.rpc("save_explore_settings", {
        new_title: "Fine",
        new_description: "",
        new_category: "No category",
        new_cover: "",
      })
    ).error,
    "server enforces categories",
  );
  ok(await a.client.rpc("set_explore_visibility", { visible: false }));
  check(
    (await search({ search_text: renamed })).items.length === 0,
    "opt-out immediately removes page from search",
  );
  check(
    ok(
      await anon
        .from("published_pages")
        .select("username")
        .eq("username", renamed),
    ).length === 1,
    "opt-out preserves direct public page",
  );
  ok(await a.client.rpc("set_explore_visibility", { visible: true }));
  ok(
    await b.client.rpc("report_explore", {
      page_username: renamed,
      report_reason: "spam",
      report_details: "Private report",
    }),
  );
  check(
    ok(await admin.from("explore_reports").select("*").eq("subject_id", a.id))
      .length === 1,
    "authenticated report stored privately",
  );
  check(
    !!(await a.client.from("explore_reports").select("*")).error &&
      !!(await anon.from("explore_reports").select("*")).error,
    "reports and reporter identity are not readable by authors/visitors",
  );
  check(
    !!(
      await anon.rpc("report_explore", {
        page_username: renamed,
        report_reason: "spam",
      })
    ).error,
    "anonymous spam reporting disallowed",
  );
  ok(
    await admin.rpc("moderate_explore", {
      page_username: renamed,
      hide: true,
      moderation_reason: "test",
    }),
  );
  ok(await a.client.rpc("set_explore_visibility", { visible: false }));
  ok(await a.client.rpc("set_explore_visibility", { visible: true }));
  await settings(a.client, "New published metadata", true);
  check(
    (await search()).items.length === 0,
    "author toggles/metadata publication cannot bypass admin hide",
  );
  ok(await a.client.rpc("unpublish_page"));
  check((await search()).items.length === 0, "unpublished page excluded");
  ok(
    await a.client.functions.invoke("page-actions", {
      body: { action: "publish", revision: 1 },
    }),
  );
  check(
    (await search()).items.length === 0,
    "moderation survives unpublish/republish",
  );
  ok(
    await admin.rpc("moderate_explore", {
      page_username: renamed,
      hide: false,
    }),
  );
  check(
    (await search()).items[0]?.title === "New published metadata",
    "saved consent and metadata snapshot survive republish",
  );
  ok(await a.client.rpc("set_explore_visibility", { visible: false }));
  ok(await a.client.rpc("unpublish_page"));
  ok(
    await a.client.functions.invoke("page-actions", {
      body: { action: "publish", revision: 1 },
    }),
  );
  check(
    (await search()).items.length === 0,
    "explicit opt-out survives republishing",
  );
  ok(await a.client.rpc("set_explore_visibility", { visible: true }));
  for (let i = 2; i < 15; i++) {
    const u = await user(i);
    ok(
      await admin.from("published_pages").insert({
        owner_id: u.id,
        username: u.username,
        project,
        source_revision: 1,
      }),
    );
    await settings(u.client, `Gallery ${i}`, true, {
      new_category: i % 2 ? "Music" : "Personal",
    });
    ok(await u.client.rpc("set_explore_visibility", { visible: true }));
  }
  const first = await search({ page_size: 12 }),
    second = await search({ page_size: 12, page_offset: 12 });
  check(
    first.items.length === 12 &&
      first.has_more &&
      second.items.length === 2 &&
      !second.has_more,
    "bounded server pagination 12 + 2",
  );
  check(
    new Set([...first.items, ...second.items].map((c) => c.username)).size ===
      14,
    "pagination has no duplicates",
  );
  const updated = await search({ sort_order: "updated" });
  check(
    updated.items.every(
      (item, i) =>
        !i ||
        Date.parse(updated.items[i - 1].updated_at) >=
          Date.parse(item.updated_at),
    ),
    "recently updated sorting",
  );
  const random = await search({ sort_order: "random", random_seed: "stable" }),
    random2 = await search({ sort_order: "random", random_seed: "stable" });
  check(
    JSON.stringify(random) === JSON.stringify(random2),
    "seeded random order is stable for pagination",
  );
  check(
    (await search({ category_filter: "Music" })).items.every(
      (c) => c.category === "Music",
    ),
    "category filtered server results",
  );
  for (const args of [
    { page_size: 200 },
    { page_offset: -1 },
    { page_offset: 10001 },
    { search_text: "x".repeat(101) },
    { sort_order: "popular" },
    { category_filter: "hack" },
  ])
    check(
      !!(await anon.rpc("search_explore", args)).error,
      `reject invalid query ${JSON.stringify(args).slice(0, 50)}`,
    );
  check(
    ok(await a.client.from("drafts").select("project").eq("owner_id", a.id))[0]
      .project.page.title === project.page.title,
    "gallery operations preserve existing draft",
  );
  console.log(
    `Explore integration: ${checks} checks passed against LOCAL Supabase.`,
  );
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
