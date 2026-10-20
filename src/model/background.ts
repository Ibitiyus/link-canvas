/** Existing v1 colors support an optional alpha byte; no project migration needed. */
export function backgroundTransparency(color: string): number {
  return color.length === 9
    ? Math.round((1 - parseInt(color.slice(7), 16) / 255) * 100)
    : 0;
}
export function withBackgroundTransparency(
  color: string,
  percent: number,
): string {
  const alpha = Math.round(
    (1 - Math.max(0, Math.min(100, percent)) / 100) * 255,
  );
  return (
    color.slice(0, 7) +
    (alpha === 255 ? "" : alpha.toString(16).padStart(2, "0"))
  );
}
