import { ROW_HEIGHT, type Block, type PageSettings } from "./types";
/** Absence is intentional: legacy decor is free, every other legacy block is grid. */
export function isFree(block: Block) {
  return (
    block.layout === "free" ||
    (block.layout === undefined && block.type === "decoration")
  );
}
export function logicalRect(block: Block, page: PageSettings) {
  if (isFree(block))
    return { x: block.x, y: block.y, width: block.width, height: block.height };
  const unit = (page.maxWidth - 40 + page.gap) / page.columns;
  return {
    x: block.col * unit,
    y: block.row * (ROW_HEIGHT + page.gap),
    width: block.colSpan * unit - page.gap,
    height: block.rowSpan * (ROW_HEIGHT + page.gap) - page.gap,
  };
}
export const normalizeAngle = (angle: number) => ((angle % 360) + 360) % 360;
