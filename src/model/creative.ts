import type { Block, Project } from "./types";
import { isFree, logicalRect, normalizeAngle } from "./placement";
import { arrange, clampBlock, firstFree } from "./grid";
import {
  decorationBounds,
  clampDecoration,
  SIZE_LIMIT,
  POSITION_LIMIT,
} from "./decoration";
import { newBlock } from "./defaults";
import { createId } from "./id";
import { moveLayer, orderedLayers } from "./layers";

export function switchLayout(
  project: Project,
  id: string,
  layout: "free" | "grid",
): Project {
  const source = project.blocks.find((b) => b.id === id);
  if (!source || source.locked || isFree(source) === (layout === "free"))
    return project;
  let block: Block;
  if (layout === "free")
    block = {
      ...source,
      ...logicalRect(source, project.page),
      layout,
      rotation: 0,
    };
  else {
    const unit =
      (project.page.maxWidth - 40 + project.page.gap) / project.page.columns;
    block = firstFree(
      clampBlock(
        {
          ...source,
          layout,
          col: Math.round(source.x / unit),
          row: Math.min(2000, Math.round(source.y / (112 + project.page.gap))),
          colSpan: Math.round((source.width + project.page.gap) / unit),
          rowSpan: Math.round(
            (source.height + project.page.gap) / (112 + project.page.gap),
          ),
        },
        project.page.columns,
      ),
      project.blocks.filter((b) => b.id !== id && !isFree(b)),
      project.page.columns,
    );
    delete block.groupId;
  }
  return cleanGroups({
    ...project,
    blocks: project.blocks.map((b) => (b.id === id ? block : b)),
  });
}
export function cleanGroups(project: Project): Project {
  if (!project.groups) return project;
  const groups = project.groups.filter((g) =>
    project.blocks.some((b) => b.groupId === g.id),
  );
  return { ...project, groups };
}
export function groupBlocks(
  project: Project,
  ids: string[],
  name = "Группа",
): Project {
  const chosen = project.blocks.filter((b) => ids.includes(b.id));
  if (chosen.length < 2 || chosen.some((b) => b.locked)) return project;
  const id = createId();
  const blocks = project.blocks.map((b) =>
    ids.includes(b.id)
      ? {
          ...b,
          ...logicalRect(b, project.page),
          layout: "free" as const,
          rotation: isFree(b) ? b.rotation : 0,
          groupId: id,
        }
      : b,
  );
  const order = orderedLayers(blocks),
    members = order.filter((b) => ids.includes(b.id)),
    rest = order.filter((b) => !ids.includes(b.id));
  const top = Math.max(...order.map((b, i) => (ids.includes(b.id) ? i : 0)));
  rest.splice(Math.min(top - members.length + 1, rest.length), 0, ...members);
  const layer = new Map(rest.map((b, i) => [b.id, i]));
  const result = cleanGroups({
    ...project,
    groups: [...(project.groups ?? []), { id, name: name.slice(0, 160) }],
    blocks: blocks.map((b) => ({ ...b, layer: layer.get(b.id)! })),
  });
  return result.groups!.length > 100 ? project : result;
}
export function ungroupBlocks(project: Project, groupId: string): Project {
  return cleanGroups({
    ...project,
    blocks: project.blocks.map((b) => {
      if (b.groupId !== groupId) return b;
      const copy = { ...b };
      delete copy.groupId;
      return copy;
    }),
  });
}
export function selectionBox(project: Project, ids: string[]): Block | null {
  const blocks = project.blocks.filter((b) => ids.includes(b.id));
  if (!blocks.length) return null;
  const bounds = blocks.map((b) =>
    decorationBounds(
      {
        ...b,
        ...logicalRect(b, project.page),
        rotation: isFree(b) ? b.rotation : 0,
      },
      1,
    ),
  );
  const left = Math.min(...bounds.map((b) => b.left)),
    top = Math.min(...bounds.map((b) => b.top));
  return {
    ...newBlock("decoration"),
    id: "__selection__",
    name: "Выделение",
    layout: "free",
    keepAspect: true,
    x: left,
    y: top,
    width: Math.max(24, Math.max(...bounds.map((b) => b.right)) - left),
    height: Math.max(24, Math.max(...bounds.map((b) => b.bottom)) - top),
    rotation: 0,
    locked: blocks.some((b) => b.locked),
  };
}
/** Groups use flattened world coordinates; uniform group scaling needs no skew or nested transforms. */
export function transformSelection(
  project: Project,
  ids: string[],
  from: Block,
  to: Block,
): Project {
  if (project.blocks.some((b) => ids.includes(b.id) && b.locked))
    return project;
  const factor = Math.min(to.width / from.width, to.height / from.height),
    angle = ((to.rotation - from.rotation) * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const center = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
  const next = project.blocks.map((b) => {
    if (!ids.includes(b.id)) return b;
    const rect = logicalRect(b, project.page),
      dx = (rect.x + rect.width / 2 - from.x - from.width / 2) * factor,
      dy = (rect.y + rect.height / 2 - from.y - from.height / 2) * factor;
    return {
      ...b,
      layout: "free" as const,
      width: rect.width * factor,
      height: rect.height * factor,
      x: center.x + dx * c - dy * s - (rect.width * factor) / 2,
      y: center.y + dx * s + dy * c - (rect.height * factor) / 2,
      rotation: normalizeAngle(
        (isFree(b) ? b.rotation : 0) + to.rotation - from.rotation,
      ),
      fontSize: b.fontSize * factor,
      radius: b.radius * factor,
      borderWidth: b.borderWidth * factor,
    };
  });
  if (
    next.some(
      (b) =>
        ids.includes(b.id) &&
        (b.width < 24 ||
          b.height < 24 ||
          b.width > SIZE_LIMIT ||
          b.height > SIZE_LIMIT ||
          Math.abs(b.x) > POSITION_LIMIT ||
          Math.abs(b.y) > POSITION_LIMIT ||
          b.fontSize < 8 ||
          b.fontSize > 144 ||
          b.radius > 100 ||
          b.borderWidth > 20),
    )
  )
    return project;
  return { ...project, blocks: next };
}
export function duplicateSelection(
  project: Project,
  ids: string[],
): { project: Project; ids: string[] } {
  const chosen = project.blocks.filter((b) => ids.includes(b.id));
  if (!chosen.length || project.blocks.length + chosen.length > 200)
    return { project, ids: [] };
  const groupIds = new Map<string, string>(),
    newIds: string[] = [];
  let blocks = [...project.blocks];
  for (const source of chosen) {
    const id = createId();
    newIds.push(id);
    if (source.groupId && !groupIds.has(source.groupId))
      groupIds.set(source.groupId, createId());
    let copy: Block = {
      ...source,
      id,
      name: `${source.name} — копия`.slice(0, 160),
      locked: false,
      x: source.x + 20,
      y: source.y + 20,
      layer: blocks.length,
      ...(source.groupId ? { groupId: groupIds.get(source.groupId)! } : {}),
    };
    if (!isFree(copy))
      copy = firstFree(
        copy,
        blocks.filter((b) => !isFree(b)),
        project.page.columns,
      );
    blocks.push(clampDecoration(copy));
  }
  const groups = [
    ...(project.groups ?? []),
    ...(project.groups ?? [])
      .filter((g) => groupIds.has(g.id))
      .map((g) => ({
        ...g,
        id: groupIds.get(g.id)!,
        name: `${g.name} — копия`.slice(0, 160),
      })),
  ];
  if (groups.length > 100) return { project, ids: [] };
  let result = { ...project, blocks, ...(groups.length ? { groups } : {}) };
  for (const id of newIds) result = moveLayer(result, id, "front");
  return { project: result, ids: newIds };
}

/** Numeric inspector resizing follows the same proportion lock as pointer handles. */
export function freeSize(
  block: Block,
  axis: "width" | "height",
  value: number,
): Pick<Block, "width" | "height"> {
  const safe = Math.max(
    24,
    Math.min(SIZE_LIMIT, Number.isFinite(value) ? value : block[axis]),
  );
  if (!block.keepAspect)
    return {
      width: axis === "width" ? safe : block.width,
      height: axis === "height" ? safe : block.height,
    };
  const factor = Math.max(
    24 / Math.min(block.width, block.height),
    Math.min(
      SIZE_LIMIT / Math.max(block.width, block.height),
      safe / block[axis],
    ),
  );
  return { width: block.width * factor, height: block.height * factor };
}
