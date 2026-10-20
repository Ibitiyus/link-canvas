import { decorationBounds } from "./decoration";
import type { Block } from "./types";
export const CANVAS_PADDING = 20;
/** Bounds in logical CSS pixels, measured from the page surface origin. */
export function canvasExtent(
  width: number,
  height: number,
  decorations: Block[],
) {
  const bounds = decorations.map((block) => decorationBounds(block, 1));
  const left = Math.min(0, ...bounds.map((b) => CANVAS_PADDING + b.left - 12));
  const top = Math.min(0, ...bounds.map((b) => CANVAS_PADDING + b.top - 12));
  const right = Math.max(
    width,
    ...bounds.map((b) => CANVAS_PADDING + b.right + 12),
  );
  const bottom = Math.max(
    height,
    ...bounds.map((b) => CANVAS_PADDING + b.bottom + 12),
  );
  return {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    width: right - left,
    height: bottom - top,
  };
}
export function fitCanvas(available: number, width: number) {
  return Math.min(1, Math.max(0, available) / Math.max(1, width));
}
