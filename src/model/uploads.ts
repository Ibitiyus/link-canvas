import { createId } from "./id";
import { fontMime, imageMime } from "./assets";
import { customFontFamily } from "./fonts";
import { storeFile } from "./fileStore";
import type { CustomFont } from "./types";
async function decodeImage(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } catch {
    throw new Error("Изображение повреждено или не поддерживается браузером.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function readImageFile(file: File): Promise<string> {
  const mime = imageMime(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (!mime) throw new Error("Выберите PNG, JPEG, WebP или GIF.");
  const blob = new Blob([file], { type: mime });
  await decodeImage(blob);
  return storeFile(blob, file.name);
}
export async function readFontFile(file: File): Promise<CustomFont> {
  const bytes = await file.arrayBuffer();
  const mime = fontMime(new Uint8Array(bytes));
  if (!mime) throw new Error("Выберите WOFF2, WOFF, TTF или OTF.");
  const id = createId();
  try {
    await new FontFace(customFontFamily(id), bytes).load();
  } catch {
    throw new Error(
      "Браузер не смог прочитать шрифт. Файл повреждён или не поддерживается.",
    );
  }
  return {
    id,
    name:
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[\u0000-\u001f]/g, "")
        .slice(0, 80) || "Мой шрифт",
    dataUrl: await storeFile(new Blob([bytes], { type: mime }), file.name),
  };
}
export async function readMediaFile(
  file: File,
  kind: "audio" | "video",
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const formats: Record<string, string> =
    kind === "video"
      ? {
          mp4: "video/mp4",
          m4v: "video/mp4",
          webm: "video/webm",
          ogv: "video/ogg",
          ogg: "video/ogg",
          mov: "video/quicktime",
        }
      : {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          ogg: "audio/ogg",
          oga: "audio/ogg",
          opus: "audio/ogg",
          m4a: "audio/mp4",
          aac: "audio/aac",
          flac: "audio/flac",
          webm: "audio/webm",
        };
  const mime = formats[extension];
  if (!mime)
    throw new Error(
      kind === "video"
        ? "Выберите MP4, WebM, OGV или MOV."
        : "Выберите MP3, WAV, OGG, M4A, AAC, FLAC или WebM.",
    );
  const blob = new Blob([file], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    await new Promise<void>((resolve, reject) => {
      const media = document.createElement(kind);
      const timer = window.setTimeout(
        () => finish(new Error("Браузер не смог прочитать метаданные файла.")),
        20000,
      );
      const finish = (error?: Error) => {
        clearTimeout(timer);
        media.onloadedmetadata = null;
        media.onerror = null;
        media.removeAttribute("src");
        media.load();
        error ? reject(error) : resolve();
      };
      media.onloadedmetadata = () => finish();
      media.onerror = () =>
        finish(
          new Error(
            "Файл повреждён или его кодек не поддерживается браузером.",
          ),
        );
      media.preload = "metadata";
      media.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
  return storeFile(blob, file.name);
}
