import { isFree } from "./placement";
import type { Block } from "./types";
export const POSITION_LIMIT = 1_000_000;
export const SIZE_LIMIT = 100_000;
/** Coordinates are relative to the grid origin, and may extend in every direction. */
export function clampDecoration(block: Block, _pageWidth?: number): Block {
  if (!isFree(block)) return block;
  return {
    ...block,
    width: Math.min(SIZE_LIMIT, Math.max(24, block.width)),
    height: Math.min(SIZE_LIMIT, Math.max(24, block.height)),
    x: Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, block.x)),
    y: Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, block.y)),
  };
}
/** Rotated bounds in displayed pixels, including negative coordinates. */
export function decorationBounds(block: Block, scale: number) {
  const width = block.width * scale,
    height = block.height * scale;
  const radians = (block.rotation * Math.PI) / 180;
  const extentX =
    (Math.abs(Math.cos(radians)) * width +
      Math.abs(Math.sin(radians)) * height) /
    2;
  const extentY =
    (Math.abs(Math.sin(radians)) * width +
      Math.abs(Math.cos(radians)) * height) /
    2;
  const centerX = block.x * scale + width / 2,
    centerY = block.y * scale + height / 2;
  return {
    left: centerX - extentX,
    right: centerX + extentX,
    top: centerY - extentY,
    bottom: centerY + extentY,
  };
}
