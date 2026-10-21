import { isFree } from "./placement";
import { clampDecoration, SIZE_LIMIT } from "./decoration";
import { clampBlock } from "./grid";
import type { Block } from "./types";
export type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export const RESIZE_EDGES: ResizeEdge[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];
export function gestureBlock(
  block: Block,
  dx: number,
  dy: number,
  columns: number,
  unitX: number,
  unitY: number,
  edge?: ResizeEdge,
): Block {
  if (block.locked) return block;
  if (isFree(block)) {
    if (!edge)
      return clampDecoration({ ...block, x: block.x + dx, y: block.y + dy });
    const angle = (block.rotation * Math.PI) / 180,
      c = Math.cos(angle),
      s = Math.sin(angle),
      u = dx * c + dy * s,
      v = -dx * s + dy * c;
    let width = Math.max(
      24,
      Math.min(
        SIZE_LIMIT,
        block.width + (edge.includes("e") ? u : edge.includes("w") ? -u : 0),
      ),
    );
    let height = Math.max(
      24,
      Math.min(
        SIZE_LIMIT,
        block.height + (edge.includes("s") ? v : edge.includes("n") ? -v : 0),
      ),
    );
    if (block.keepAspect) {
      let factor =
        edge.includes("e") || edge.includes("w")
          ? width / block.width
          : height / block.height;
      if (
        edge.length === 2 &&
        Math.abs(height / block.height - 1) > Math.abs(width / block.width - 1)
      )
        factor = height / block.height;
      factor = Math.max(
        24 / Math.min(block.width, block.height),
        Math.min(SIZE_LIMIT / Math.max(block.width, block.height), factor),
      );
      width = block.width * factor;
      height = block.height * factor;
    }
    const shiftX =
      ((width - block.width) / 2) *
      (edge.includes("w") ? -1 : edge.includes("e") ? 1 : 0);
    const shiftY =
      ((height - block.height) / 2) *
      (edge.includes("n") ? -1 : edge.includes("s") ? 1 : 0);
    return clampDecoration({
      ...block,
      width,
      height,
      x: block.x + block.width / 2 + shiftX * c - shiftY * s - width / 2,
      y: block.y + block.height / 2 + shiftX * s + shiftY * c - height / 2,
    });
  }
  const x = Math.round(dx / unitX),
    y = Math.round(dy / unitY);
  if (!edge)
    return clampBlock(
      { ...block, col: block.col + x, row: Math.min(2000, block.row + y) },
      columns,
    );
  let left = block.col,
    right = left + block.colSpan,
    top = block.row,
    bottom = top + block.rowSpan;
  if (edge.includes("w")) left = Math.max(0, Math.min(right - 1, left + x));
  if (edge.includes("e"))
    right = Math.min(columns, Math.max(left + 1, right + x));
  if (edge.includes("n"))
    top = Math.max(0, Math.min(bottom - 1, Math.max(bottom - 12, top + y)));
  if (edge.includes("s"))
    bottom = Math.min(top + 12, Math.max(top + 1, bottom + y));
  return clampBlock(
    {
      ...block,
      col: left,
      row: top,
      colSpan: right - left,
      rowSpan: bottom - top,
    },
    columns,
  );
}
