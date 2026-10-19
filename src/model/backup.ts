import type { Project } from "./types";
import { parseProject } from "./storage";
import { getFile, isAssetRef, storeFiles, type StoredFile } from "./fileStore";
import { createId } from "./id";
import { dataUrlMime } from "./assets";
function sources(project: Project): string[] {
  return [
    project.page.backgroundImage,
    ...(project.customFonts ?? []).map((font) => font.dataUrl),
    ...project.blocks.flatMap((block) => [
      block.imageUrl,
      ...(["image", "gif", "video", "audio"].includes(block.type)
        ? [block.url]
        : []),
    ]),
  ];
}
function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Не удалось прочитать файл для резервной копии."));
    reader.readAsDataURL(blob);
  });
}
export async function exportProject(project: Project): Promise<Blob> {
  const assets: Record<string, { name: string; dataUrl: string }> = {};
  for (const ref of new Set(sources(project).filter(isAssetRef))) {
    const file = await getFile(ref);
    assets[ref] = { name: file.name, dataUrl: await blobDataUrl(file.blob) };
  }
  return new Blob(
    [
      JSON.stringify({
        ...project,
        ...(Object.keys(assets).length ? { assets } : {}),
      }),
    ],
    { type: "application/json" },
  );
}
function decodeFile(value: unknown): Blob {
  if (typeof value !== "string")
    throw new Error("В резервной копии отсутствуют данные файла.");
  const comma = value.indexOf(",");
  const header = /^data:([a-z0-9/-]+);base64$/.exec(value.slice(0, comma));
  const mime = header?.[1];
  const media = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
    "audio/flac",
    "audio/webm",
  ];
  if (
    !mime ||
    !(
      media.includes(mime) ||
      dataUrlMime(value, mime.startsWith("image/") ? "image" : "font")
    )
  )
    throw new Error("Резервная копия содержит неподдерживаемый файл.");
  try {
    const parts: Uint8Array<ArrayBuffer>[] = [];
    for (let i = comma + 1; i < value.length; i += 65536)
      parts.push(
        Uint8Array.from(atob(value.slice(i, i + 65536)), (c) =>
          c.charCodeAt(0),
        ),
      );
    return new Blob(parts, { type: mime });
  } catch {
    throw new Error("Данные файла в резервной копии повреждены.");
  }
}
export async function importProject(raw: string): Promise<Project> {
  const project = parseProject(raw);
  const input = JSON.parse(raw) as {
    assets?: Record<string, { dataUrl?: unknown; name?: unknown }>;
  };
  const refs = new Set(sources(project).filter(isAssetRef));
  const replacements = new Map<string, string>();
  const files: StoredFile[] = [];
  for (const ref of refs) {
    const asset =
      input.assets && Object.hasOwn(input.assets, ref)
        ? input.assets[ref]
        : null;
    if (!asset)
      throw new Error(
        "В JSON отсутствуют файлы проекта. Создайте полную копию кнопкой «Экспорт JSON».",
      );
    const id = createId();
    files.push({
      id,
      name: typeof asset.name === "string" ? asset.name.slice(0, 255) : "Файл",
      blob: decodeFile(asset.dataUrl),
    });
    replacements.set(ref, `asset:${id}`);
  }
  // A new ID preserves files referenced by undo history; one transaction avoids a partial import.
  await storeFiles(files);
  const replace = (value: string) => replacements.get(value) ?? value;
  return {
    ...project,
    page: {
      ...project.page,
      backgroundImage: replace(project.page.backgroundImage),
    },
    ...(project.customFonts
      ? {
          customFonts: project.customFonts.map((font) => ({
            ...font,
            dataUrl: replace(font.dataUrl),
          })),
        }
      : {}),
    blocks: project.blocks.map((block) => ({
      ...block,
      url: ["image", "gif", "video", "audio"].includes(block.type)
        ? replace(block.url)
        : block.url,
      imageUrl: replace(block.imageUrl),
    })),
  };
}
export function downloadBackup(blob: Blob, name = "link-canvas.json") {
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
