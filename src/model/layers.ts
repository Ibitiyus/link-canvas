import type { Block, Project } from "./types";
/** Bottom to top. Legacy projects keep grid-first/decor-zIndex ordering. */
export function orderedLayers(blocks: Block[]): Block[] {
  const legacy = [
    ...blocks.filter((b) => b.type !== "decoration"),
    ...blocks
      .filter((b) => b.type === "decoration")
      .sort((a, b) => a.zIndex - b.zIndex),
  ];
  const fallback = new Map(legacy.map((b, i) => [b.id, i]));
  return [...legacy].sort(
    (a, b) =>
      (a.layer ?? fallback.get(a.id)!) - (b.layer ?? fallback.get(b.id)!),
  );
}
export function moveLayer(
  project: Project,
  id: string,
  action: "front" | "back" | "up" | "down" | number,
): Project {
  const order = orderedLayers(project.blocks),
    index = order.findIndex((b) => b.id === id);
  if (index < 0) return project;
  const target =
    typeof action === "number"
      ? Math.max(0, Math.min(order.length - 1, action))
      : action === "front"
        ? order.length - 1
        : action === "back"
          ? 0
          : Math.max(
              0,
              Math.min(order.length - 1, index + (action === "up" ? 1 : -1)),
            );
  if (index === target) return project;
  const [block] = order.splice(index, 1);
  order.splice(target, 0, block);
  const layers = new Map(order.map((b, i) => [b.id, i]));
  return {
    ...project,
    blocks: project.blocks.map((b) => ({ ...b, layer: layers.get(b.id)! })),
  };
}
export const GEOMETRY_KEYS = [
  "col",
  "row",
  "colSpan",
  "rowSpan",
  "x",
  "y",
  "width",
  "height",
  "rotation",
] as const;
export function positionPatch(
  block: Block,
  patch: Partial<Block>,
): Partial<Block> {
  const safe = { ...patch };
  if (block.locked) for (const key of GEOMETRY_KEYS) delete safe[key];
  return safe;
}
