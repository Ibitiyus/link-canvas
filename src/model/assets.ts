import { safeUrl } from "./media";
export const MAX_ASSET_BYTES = 1_048_576;
export const MAX_DATA_URL_LENGTH = 1_400_000;
export const MAX_CUSTOM_FONTS = 8;
export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export type FontMime = "font/woff2" | "font/woff" | "font/ttf" | "font/otf";
const ascii = (bytes: Uint8Array, start: number, count: number) =>
  String.fromCharCode(...bytes.slice(start, start + count));
export function imageMime(bytes: Uint8Array): ImageMime | null {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP")
    return "image/webp";
  return null;
}
export function fontMime(bytes: Uint8Array): FontMime | null {
  const magic = ascii(bytes, 0, 4);
  if (magic === "wOF2") return "font/woff2";
  if (magic === "wOFF") return "font/woff";
  if (magic === "OTTO") return "font/otf";
  if (
    (bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0) ||
    magic === "true"
  )
    return "font/ttf";
  return null;
}
export function dataUrlMime(
  value: string,
  kind: "image" | "font",
): string | null {
  if (value.length > MAX_DATA_URL_LENGTH) return null;
  const match = /^data:([a-z0-9/-]+);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!match || match[2].length % 4 !== 0) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2].slice(0, 64)), (c) =>
      c.charCodeAt(0),
    );
    const mime = kind === "image" ? imageMime(bytes) : fontMime(bytes);
    return mime === match[1] ? mime : null;
  } catch {
    return null;
  }
}
export function safeImageSource(value: string): string | null {
  return value.startsWith("data:")
    ? dataUrlMime(value, "image")
      ? value
      : null
    : safeUrl(value);
}
export function parseImageSource(value: unknown): string {
  if (typeof value !== "string") return "";
  if (value.startsWith("data:")) {
    if (!dataUrlMime(value, "image"))
      throw new Error("Некорректный файл изображения в проекте.");
    return value;
  }
  return value.slice(0, 2048);
}
