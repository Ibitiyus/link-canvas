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
    source = order.find((b) => b.id === id);
  if (!source) return project;
  const units: Block[][] = [];
  const seen = new Set<string>();
  for (const block of order) {
    const key = block.groupId ? `group:${block.groupId}` : `block:${block.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    units.push(
      block.groupId
        ? order.filter((b) => b.groupId === block.groupId)
        : [block],
    );
  }
  const index = units.findIndex((unit) => unit.some((b) => b.id === id));
  const target =
    typeof action === "number"
      ? units.findIndex((unit) =>
          unit.some(
            (b) =>
              b.id ===
              order[Math.max(0, Math.min(order.length - 1, action))]?.id,
          ),
        )
      : action === "front"
        ? units.length - 1
        : action === "back"
          ? 0
          : Math.max(
              0,
              Math.min(units.length - 1, index + (action === "up" ? 1 : -1)),
            );
  if (target === index || target < 0) return project;
  const [unit] = units.splice(index, 1);
  units.splice(target, 0, unit);
  const layers = new Map(units.flat().map((b, i) => [b.id, i]));
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
  "layout",
  "keepAspect",
] as const;
export function positionPatch(
  block: Block,
  patch: Partial<Block>,
): Partial<Block> {
  const safe = { ...patch };
  if (block.locked) for (const key of GEOMETRY_KEYS) delete safe[key];
  return safe;
}
