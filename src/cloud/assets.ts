import { Upload, DefaultHttpStack } from "tus-js-client";
import { createId } from "../model/id";
import { getFile, isAssetRef } from "../model/fileStore";
import { dataUrlMime } from "../model/assets";
import {
  requireCloud,
  ownerClient,
  cloudUrl,
  cloudKey,
  maxCloudFileBytes,
} from "./config";
import { isCloudRef, mapProjectSources, projectSources } from "./projectAssets";
import type { Project } from "../model/types";
const extensions: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogg",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/webm": "webm",
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "ttf",
  "font/otf": "otf",
};
class LocalTusStack extends DefaultHttpStack {
  override createRequest(method: string, address: string) {
    const target = new URL(address),
      base = new URL(cloudUrl);
    // Local Storage can return an https Location despite the CLI using plain HTTP.
    if (
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
      target.host === base.host
    )
      target.protocol = "http:";
    return super.createRequest(method, target.href);
  }
}
export async function cloudFile(ref: string) {
  if (!isCloudRef(ref))
    throw new Error("Некорректная ссылка на облачный файл.");
  const owner = ref.slice(6).split("/")[0];
  const { data, error } = await ownerClient(owner)
    .storage.from("zin-drafts")
    .download(ref.slice(6));
  if (error) throw error;
  return { blob: data, name: ref.split("/").pop()! };
}
export async function signedAsset(ref: string) {
  const owner = ref.slice(6).split("/")[0];
  const { data, error } = await ownerClient(owner)
    .storage.from("zin-drafts")
    .createSignedUrl(ref.slice(6), 86400);
  if (error) throw error;
  return data.signedUrl;
}
export async function assetBlob(source: string) {
  if (isAssetRef(source)) return (await getFile(source)).blob;
  if (isCloudRef(source)) return (await cloudFile(source)).blob;
  if (
    source.startsWith("data:") &&
    (dataUrlMime(source, "image") || dataUrlMime(source, "font"))
  )
    return (await fetch(source)).blob();
  throw new Error("Неподдерживаемый локальный файл.");
}
export async function pageAction<T>(
  owner: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await ownerClient(owner).functions.invoke(
    "page-actions",
    { body },
  );
  if (error) {
    const response = "context" in error ? error.context : null;
    if (response instanceof Response) {
      const payload = await response.json().catch(() => null);
      if (payload?.error) throw new Error(payload.error);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}
async function uploadFile(
  owner: string,
  blob: Blob,
  progress: (percent: number) => void,
  signal: AbortSignal,
) {
  const extension = extensions[blob.type];
  if (!extension)
    throw new Error(
      "Этот тип файла не поддерживается облачным хранилищем. HTML и SVG загружать нельзя.",
    );
  if (blob.size > maxCloudFileBytes)
    throw new Error(
      `Файл больше облачного лимита ${Math.round(maxCloudFileBytes / 1024 / 1024)} МБ. Локальная копия сохранена.`,
    );
  const client = ownerClient(owner);
  const { data: path, error } = await client.rpc("reserve_asset", {
    file_id: createId(),
    extension,
    content_type: blob.type,
    bytes: blob.size,
  });
  if (error) throw error;
  const { data } = await requireCloud().auth.getSession();
  if (data.session?.user.id !== owner || signal.aborted)
    throw new Error("SESSION_CHANGED");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(blob, {
      httpStack: new LocalTusStack({}),
      endpoint: `${cloudUrl}/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${data.session!.access_token}`,
        apikey: cloudKey,
      },
      metadata: {
        bucketName: "zin-drafts",
        objectName: path,
        contentType: blob.type,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      retryDelays: [0, 1000, 3000, 5000],
      onError: (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
      onProgress: (sent, total) => progress(Math.round((sent / total) * 100)),
      onSuccess: () => {
        signal.removeEventListener("abort", abort);
        resolve();
      },
    });
    const abort = () => {
      void upload.abort().catch(() => {});
      reject(new Error("SESSION_CHANGED"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    try {
      upload.start();
    } catch (error) {
      signal.removeEventListener("abort", abort);
      reject(error);
    }
  });
  if (signal.aborted) throw new Error("SESSION_CHANGED");
  await pageAction(owner, { action: "complete-upload", path });
  return `cloud:${path}`;
}
export async function uploadProject(
  project: Project,
  owner: string,
  cache: Map<string, string>,
  signal: AbortSignal,
  progress: (label: string) => void,
): Promise<Project> {
  const refs = [
    ...new Set(
      projectSources(project).filter(
        (source) => isAssetRef(source) || source.startsWith("data:"),
      ),
    ),
  ];
  const paths = refs
    .map((ref) => cache.get(ref))
    .filter((ref): ref is string => !!ref)
    .map((ref) => ref.slice(6));
  if (paths.length) {
    const { data, error } = await ownerClient(owner)
      .from("assets")
      .select("path,state")
      .in("path", paths);
    if (error) throw error;
    for (const ref of refs) {
      const stored = cache.get(ref);
      if (
        stored &&
        !data.some(
          (file) => file.path === stored.slice(6) && file.state === "ready",
        )
      )
        cache.delete(ref);
    }
  }
  for (let index = 0; index < refs.length; index++) {
    const ref = refs[index];
    if (signal.aborted) throw new Error("SESSION_CHANGED");
    if (!cache.has(ref)) {
      const blob = await assetBlob(ref);
      const cloud = await uploadFile(
        owner,
        blob,
        (percent) =>
          progress(`Файл ${index + 1} из ${refs.length}: ${percent}%`),
        signal,
      );
      cache.set(ref, cloud);
    }
  }
  for (const ref of projectSources(project).filter(isCloudRef))
    if (!ref.startsWith(`cloud:${owner}/`))
      throw new Error(
        "Файл принадлежит другому аккаунту. Импортируйте полную JSON-копию.",
      );
  return mapProjectSources(project, (source) => cache.get(source) ?? source);
}
