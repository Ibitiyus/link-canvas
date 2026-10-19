import { createId } from "./id";
import { fontMime, imageMime, MAX_ASSET_BYTES } from "./assets";
import { customFontFamily } from "./fonts";
import type { CustomFont } from "./types";
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Не удалось прочитать файл с устройства."));
    reader.readAsDataURL(blob);
  });
}
async function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new Error("Изображение повреждено или не поддерживается браузером.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function readImageFile(file: File): Promise<string> {
  if (file.size > 10_000_000)
    throw new Error("Изображение слишком большое. Максимум — 10 МБ.");
  const mime = imageMime(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (!mime) throw new Error("Выберите PNG, JPEG, WebP или GIF.");
  if (mime === "image/gif" && file.size > MAX_ASSET_BYTES)
    throw new Error(
      "GIF должен быть не больше 1 МБ, чтобы сохранить анимацию в проекте.",
    );
  const blob = new Blob([file], { type: mime });
  const image = await decodeImage(blob);
  if (
    mime === "image/gif" ||
    (file.size <= 300_000 &&
      image.naturalWidth <= 1600 &&
      image.naturalHeight <= 1600)
  )
    return dataUrl(blob);
  const scale = Math.min(
    1,
    1600 / image.naturalWidth,
    1600 / image.naturalHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Браузер не смог подготовить изображение.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.85, 0.65, 0.45]) {
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (compressed && compressed.size <= MAX_ASSET_BYTES)
      return dataUrl(compressed);
  }
  throw new Error(
    "Не удалось уменьшить изображение до 1 МБ. Выберите файл меньшего размера.",
  );
}
export async function readFontFile(file: File): Promise<CustomFont> {
  if (file.size > MAX_ASSET_BYTES)
    throw new Error("Файл шрифта должен быть не больше 1 МБ.");
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
    dataUrl: await dataUrl(new Blob([bytes], { type: mime })),
  };
}
