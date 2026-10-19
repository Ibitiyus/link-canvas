import { clampDecoration } from "./decoration";
import type { Block, Project } from "./types";

export function overlaps(a: Block, b: Block): boolean {
  return (
    a.col < b.col + b.colSpan &&
    a.col + a.colSpan > b.col &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  );
}
export function clampBlock(block: Block, columns: number): Block {
  const colSpan = Math.max(1, Math.min(columns, Math.round(block.colSpan)));
  return {
    ...block,
    colSpan,
    rowSpan: Math.max(1, Math.min(12, Math.round(block.rowSpan))),
    col: Math.max(0, Math.min(columns - colSpan, Math.round(block.col))),
    row: Math.max(0, Math.round(block.row)),
  };
}
export function firstFree(
  block: Block,
  occupied: Block[],
  columns: number,
): Block {
  const candidate = clampBlock(block, columns);
  if (!occupied.some((other) => overlaps(candidate, other))) return candidate;
  // Preserve the intended row where possible; displaced blocks flow downwards.
  for (let row = candidate.row; ; row++) {
    for (let col = 0; col <= columns - candidate.colSpan; col++) {
      const next = { ...candidate, row, col };
      if (!occupied.some((other) => overlaps(next, other))) return next;
    }
  }
}
export function arrange(
  blocks: Block[],
  columns: number,
  priorityId?: string,
): Block[] {
  const ordered = [...blocks.filter((b) => b.type !== "decoration")];
  const index = ordered.findIndex((b) => b.id === priorityId);
  if (index > 0) ordered.unshift(...ordered.splice(index, 1));
  const placed: Block[] = [];
  for (const block of ordered) placed.push(firstFree(block, placed, columns));
  const byId = new Map(placed.map((block) => [block.id, block]));
  return blocks.map((block) => byId.get(block.id) ?? block);
}
export function editBlock(
  project: Project,
  id: string,
  patch: Partial<Block>,
): Project {
  const blocks = project.blocks.map((block) =>
    block.id === id
      ? { ...block, ...patch, id: block.id, type: block.type }
      : block,
  );
  return {
    ...project,
    blocks: arrange(
      blocks.map((block) => clampDecoration(block, project.page.maxWidth)),
      project.page.columns,
      id,
    ),
  };
}
export function gridRows(blocks: Block[]): number {
  return (
    Math.max(
      5,
      ...blocks
        .filter((b) => b.type !== "decoration")
        .map((b) => b.row + b.rowSpan),
    ) + 1
  );
}
