import type { Block } from "./types";
/** Free elements use page-width coordinates so horizontal placement scales in preview. */
export function clampDecoration(block: Block, pageWidth: number): Block {
  if (block.type !== "decoration") return block;
  const width = Math.min(pageWidth, Math.max(24, block.width));
  return {
    ...block,
    width,
    x: Math.max(0, Math.min(pageWidth - width, block.x)),
    y: Math.max(0, Math.min(30000, block.y)),
  };
}
