import type { CustomFont } from "./types";
export const BUILTIN_FONTS = {
  system: { label: "Системный Sans", family: "system-ui, sans-serif" },
  arial: { label: "Arial", family: "Arial, sans-serif" },
  verdana: { label: "Verdana", family: "Verdana, sans-serif" },
  georgia: { label: "Georgia", family: "Georgia, serif" },
  times: { label: "Times New Roman", family: '"Times New Roman", serif' },
  courier: { label: "Courier New", family: '"Courier New", monospace' },
  archivo: { label: "Archivo Black", family: '"Archivo Black", sans-serif' },
  plex: { label: "IBM Plex Mono", family: '"IBM Plex Mono", monospace' },
};
export const customFontFamily = (id: string) => `LCFont-${id}`;
export function resolveBlockFont(value?: string): string | undefined {
  if (!value || value === "inherit") return undefined;
  if (Object.hasOwn(BUILTIN_FONTS, value))
    return BUILTIN_FONTS[value as keyof typeof BUILTIN_FONTS].family;
  if (/^font:[A-Za-z0-9_-]{1,100}$/.test(value))
    return `"${customFontFamily(value.slice(5))}", sans-serif`;
  return undefined;
}
export function validFontChoice(
  value: unknown,
  fonts: CustomFont[],
): value is string {
  return (
    typeof value === "string" &&
    (value === "inherit" ||
      Object.hasOwn(BUILTIN_FONTS, value) ||
      fonts.some((font) => value === `font:${font.id}`))
  );
}
