// Native fetch keeps the worker self-contained: no CDN/runtime package downloads.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
function sources(project: any): string[] {
  return [
    project.page.backgroundImage,
    ...(project.customFonts ?? []).map((font: any) => font.dataUrl),
    ...project.blocks.flatMap((block: any) => [
      block.imageUrl,
      ...(["image", "gif", "video", "audio"].includes(block.type)
        ? [block.url]
        : []),
    ]),
  ].filter(Boolean);
}
function replaceSources(project: any, replacements: Map<string, string>) {
  const replace = (value: string) => replacements.get(value) ?? value;
  return {
    ...project,
    page: {
      ...project.page,
      backgroundImage: replace(project.page.backgroundImage),
    },
    ...(project.customFonts
      ? {
          customFonts: project.customFonts.map((font: any) => ({
            ...font,
            dataUrl: replace(font.dataUrl),
          })),
        }
      : {}),
    blocks: project.blocks.map((block: any) => ({
      ...block,
      imageUrl: replace(block.imageUrl),
      url: ["image", "gif", "video", "audio"].includes(block.type)
        ? replace(block.url)
        : block.url,
    })),
  };
}
function validBytes(bytes: Uint8Array, mime: string) {
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...bytes.slice(start, start + length));
  if (mime === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  if (mime === "image/jpeg")
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(ascii(0, 6));
  if (mime === "image/webp")
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (mime === "font/woff2") return ascii(0, 4) === "wOF2";
  if (mime === "font/woff") return ascii(0, 4) === "wOFF";
  if (mime === "font/otf") return ascii(0, 4) === "OTTO";
  if (mime === "font/ttf")
    return (
      (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) ||
      ascii(0, 4) === "true"
    );
  if (["video/mp4", "video/quicktime", "audio/mp4"].includes(mime))
    return ascii(4, 4) === "ftyp";
  if (["video/webm", "audio/webm"].includes(mime))
    return [26, 69, 223, 163].every((n, i) => bytes[i] === n);
  if (["video/ogg", "audio/ogg"].includes(mime)) return ascii(0, 4) === "OggS";
  if (mime === "audio/wav")
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE";
  if (mime === "audio/flac") return ascii(0, 4) === "fLaC";
  if (mime === "audio/mpeg")
    return (
      ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224)
    );
  if (mime === "audio/aac") return bytes[0] === 255 && (bytes[1] & 246) === 240;
  return false;
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  if (request.method !== "POST")
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!,
    anon = Deno.env.get("SUPABASE_ANON_KEY")!,
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") ?? "";
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: authorization },
  }).catch(() => null);
  if (!response?.ok) {
    console.warn(
      "Auth verification failed",
      response?.status ?? "network",
      new URL(url).hostname,
    );
    return json({ error: "NOT_AUTHENTICATED" }, 401);
  }
  const user = await response.json();
  if (!user.id) return json({ error: "NOT_AUTHENTICATED" }, 401);
  const api = async (
    path: string,
    {
      admin = false,
      method = "GET",
      body,
      headers = {},
    }: {
      admin?: boolean;
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        apikey: admin ? service : anon,
        Authorization: admin ? `Bearer ${service}` : authorization,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        payload?.message ?? payload?.error ?? `HTTP_${response.status}`,
      );
    return payload;
  };
  const rpc = (name: string, body: unknown, admin = false) =>
    api(`/rest/v1/rpc/${name}`, { method: "POST", body, admin });
  const remove = (bucket: string, paths: string[]) =>
    api(`/storage/v1/object/${bucket}`, {
      method: "DELETE",
      body: { prefixes: paths },
      admin: true,
    });
  const list = async (bucket: string, prefix: string) => {
    const files: any[] = [];
    for (let offset = 0; ; offset += 1000) {
      const batch = await api(`/storage/v1/object/list/${bucket}`, {
        method: "POST",
        body: {
          prefix,
          limit: 1000,
          offset,
          sortBy: { column: "name", order: "asc" },
        },
        admin: true,
      });
      files.push(...batch);
      if (batch.length < 1000) return files;
    }
  };
  let publicationToken: string | undefined;
  try {
    const body = await request.json();
    if (body.action === "complete-upload") {
      if (typeof body.path !== "string" || !body.path.startsWith(`${user.id}/`))
        throw new Error("ASSET_NOT_FOUND");
      const filter = `path=eq.${encodeURIComponent(body.path)}&owner_id=eq.${user.id}`;
      const assets = await api(`/rest/v1/assets?${filter}&select=*`),
        asset = assets[0];
      if (!asset) throw new Error("ASSET_NOT_FOUND");
      if (asset.state === "ready") return json({ ready: true });
      if (asset.state !== "uploading") throw new Error("ASSET_NOT_READY");
      const response = await fetch(
        `${url}/storage/v1/object/authenticated/zin-drafts/${asset.path}`,
        {
          headers: {
            Authorization: `Bearer ${service}`,
            apikey: service,
            Range: "bytes=0-63",
          },
        },
      );
      if (!response.ok) throw new Error("FILE_NOT_UPLOADED");
      const bytes = new Uint8Array(await response.arrayBuffer());
      const total = Number(
        response.headers.get("Content-Range")?.split("/")[1] ??
          response.headers.get("Content-Length"),
      );
      if (total !== Number(asset.size) || !validBytes(bytes, asset.mime))
        throw new Error("UNSUPPORTED_FILE");
      const updated = await api(
        `/rest/v1/assets?${filter}&state=eq.uploading`,
        {
          method: "PATCH",
          body: { state: "ready" },
          admin: true,
          headers: { Prefer: "return=representation" },
        },
      );
      if (updated.length !== 1) throw new Error("ASSET_NOT_READY");
      return json({ ready: true });
    }
    if (body.action === "publish") {
      const job = await rpc("begin_publication", {
        expected_revision: body.revision,
      });
      publicationToken = job.token;
      const replacements = new Map<string, string>();
      for (const source of new Set(sources(job.project))) {
        if (!source.startsWith("cloud:")) continue;
        const path = source.slice(6);
        const assets = await api(
          `/rest/v1/assets?path=eq.${encodeURIComponent(path)}&select=path,state`,
        );
        if (assets[0]?.state !== "ready" || !path.startsWith(`${user.id}/`))
          throw new Error("ASSET_NOT_READY");
        const target = `${user.id}/${job.token}/${path.split("/").pop()}`;
        await api("/storage/v1/object/copy", {
          method: "POST",
          body: {
            bucketId: "zin-drafts",
            sourceKey: path,
            destinationBucket: "zin-public",
            destinationKey: target,
          },
          admin: true,
        });
        const publicUrl = (
          Deno.env.get("ZIN_PUBLIC_SUPABASE_URL") ?? url
        ).replace(/\/$/, "");
        replacements.set(
          source,
          `${publicUrl}/storage/v1/object/public/zin-public/${target}`,
        );
      }
      const page = await rpc(
        "finish_publication",
        {
          who: user.id,
          job_token: job.token,
          value: replaceSources(job.project, replacements),
        },
        true,
      );
      publicationToken = undefined;
      return json({ page });
    }
    if (body.action === "cleanup") {
      const assets = await rpc("claim_unused_assets", { who: user.id }, true);
      let removed = 0;
      for (const asset of assets) {
        await remove("zin-drafts", [asset.path]);
        await api(
          `/rest/v1/assets?path=eq.${encodeURIComponent(asset.path)}&owner_id=eq.${user.id}&state=eq.deleting`,
          { admin: true, method: "DELETE" },
        );
        removed++;
      }
      const pages = await api(
        `/rest/v1/published_pages?owner_id=eq.${user.id}&select=project`,
        { admin: true },
      );
      const live = pages[0] ? sources(pages[0].project) : [];
      const folders = await list("zin-public", user.id);
      for (const folder of folders) {
        if (folder.id) continue;
        const prefix = `${user.id}/${folder.name}`,
          files = await list("zin-public", prefix);
        const paths = files
          .filter(
            (file: any) =>
              Date.parse(file.created_at) < Date.now() - 86400000 &&
              !live.some((source) =>
                source.includes(`/zin-public/${prefix}/${file.name}`),
              ),
          )
          .map((file: any) => `${prefix}/${file.name}`);
        if (paths.length) {
          await remove("zin-public", paths);
          removed += paths.length;
        }
      }
      return json({ removed });
    }
    throw new Error("UNKNOWN_ACTION");
  } catch (error) {
    if (publicationToken)
      await api(
        `/rest/v1/publication_jobs?owner_id=eq.${user.id}&token=eq.${publicationToken}`,
        { method: "DELETE", admin: true },
      ).catch(() => {});
    const message = error instanceof Error ? error.message : "REQUEST_FAILED";
    return json(
      { error: message },
      message.includes("REVISION_CONFLICT") ? 409 : 400,
    );
  }
});
