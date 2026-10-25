export type GridVisibility = "auto" | "light" | "dark" | "hidden";
/** Contrast applies only to editor overlays, never to saved project styles. */
export function editorGrid(
  background: string,
  image: boolean,
  mode: GridVisibility,
) {
  const hex = background.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const alpha =
    normalized.length === 8 ? parseInt(normalized.slice(6), 16) / 255 : 1;
  const rgb = /^[\da-f]{6}([\da-f]{2})?$/i.test(normalized)
    ? [0, 2, 4].map(
        (i, channel) =>
          parseInt(normalized.slice(i, i + 2), 16) * alpha +
          [7, 7, 10][channel] * (1 - alpha),
      )
    : [7, 7, 10];
  const light =
    mode === "dark" ||
    (mode === "auto" &&
      !image &&
      rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722 > 150);
  return {
    line: light ? "rgba(32,14,31,.62)" : "rgba(255,225,242,.65)",
    tint: light ? "rgba(32,14,31,.035)" : "rgba(255,225,242,.035)",
    halo: light ? "rgba(255,255,255,.40)" : "rgba(0,0,0,.55)",
  };
}
