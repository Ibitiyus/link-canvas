import { COVER_LIMIT, isCover } from "./model";
/** Decode once, strip metadata/animation, and re-encode a bounded raster thumbnail. */
export async function createGalleryCover(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error(
      "Для обложки выберите PNG, JPEG или WebP. GIF и SVG не поддерживаются.",
    );
  if (file.size > 20 * 1024 * 1024)
    throw new Error("Исходная обложка должна быть меньше 20 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error("Не удалось открыть изображение.");
    });
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 300;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не поддерживает создание обложки.");
    context.fillStyle = "#151115";
    context.fillRect(0, 0, 480, 300);
    const ratio = Math.max(480 / image.naturalWidth, 300 / image.naturalHeight);
    const width = image.naturalWidth * ratio,
      height = image.naturalHeight * ratio;
    context.drawImage(
      image,
      (480 - width) / 2,
      (300 - height) / 2,
      width,
      height,
    );
    for (const quality of [0.78, 0.6, 0.4, 0.25]) {
      const result = canvas.toDataURL("image/jpeg", quality);
      if (isCover(result) && atob(result.slice(23)).length <= COVER_LIMIT)
        return result;
    }
    throw new Error(
      "Не удалось уменьшить обложку до 64 КБ. Выберите другое изображение.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
