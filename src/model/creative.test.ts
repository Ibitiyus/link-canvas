import { describe, it, expect } from "vitest";
import { emptyProject, newBlock } from "./defaults";
import {
  switchLayout,
  groupBlocks,
  ungroupBlocks,
  selectionBox,
  transformSelection,
  duplicateSelection,
} from "./creative";
import { isFree, logicalRect } from "./placement";
import { parseProject } from "./storage";
import { gestureBlock } from "./gestures";
import { editBlock, overlaps } from "./grid";
import { historyReducer } from "../state/history";
import { moveLayer, orderedLayers } from "./layers";
import type { BlockType } from "./types";
const types: BlockType[] = [
  "link",
  "text",
  "image",
  "gif",
  "video",
  "audio",
  "qrcode",
  "decoration",
];
const fixture = () => ({
  ...emptyProject(),
  blocks: [
    { ...newBlock("text"), id: "text", col: 1, row: 2, colSpan: 2, rowSpan: 2 },
    {
      ...newBlock("image"),
      id: "photo",
      col: 0,
      row: 0,
      colSpan: 1,
      rowSpan: 2,
    },
  ],
});
describe("hybrid canvas", () => {
  it.each(types)(
    "%s supports both layouts without changing its media or style",
    (type) => {
      const b = {
        ...newBlock(type),
        id: "b",
        layout: "grid" as const,
        col: 1,
        row: 2,
        colSpan: 2,
        rowSpan: 2,
        background: "#11223380",
        url: "https://example.com/test",
      };
      const p = { ...emptyProject(), blocks: [b] },
        rect = logicalRect(b, p.page),
        free = switchLayout(p, b.id, "free");
      expect(free.blocks[0]).toMatchObject({
        ...rect,
        layout: "free",
        background: b.background,
        url: b.url,
      });
      const back = switchLayout(free, b.id, "grid");
      expect(back.blocks[0]).toMatchObject({
        layout: "grid",
        col: 1,
        row: 2,
        colSpan: 2,
        rowSpan: 2,
      });
    },
  );
  it("finds unoccupied grid space on return, ignoring free overlapping elements", () => {
    const p = fixture(),
      free = switchLayout(p, "text", "free");
    free.blocks.push({
      ...newBlock("text"),
      id: "busy",
      col: 1,
      row: 2,
      colSpan: 2,
      rowSpan: 2,
    });
    const result = switchLayout(free, "text", "grid"),
      grid = result.blocks.filter((b) => !isFree(b));
    for (let i = 0; i < grid.length; i++)
      for (let j = i + 1; j < grid.length; j++)
        expect(overlaps(grid[i], grid[j])).toBe(false);
  });
  it("locked elements cannot switch modes or resize/move/rotate", () => {
    const p = fixture();
    p.blocks[0].locked = true;
    expect(switchLayout(p, "text", "free")).toBe(p);
    const b = { ...p.blocks[0], layout: "free" as const };
    expect(gestureBlock(b, 100, 100, 4, 200, 128, "se")).toBe(b);
    expect(
      editBlock({ ...p, blocks: [b] }, "text", {
        layout: "grid",
        x: 999,
        rotation: 360,
      }).blocks[0],
    ).toMatchObject({ layout: "free", x: b.x, rotation: b.rotation });
  });
  it("proportion-locked rotated free media keeps its aspect and opposite corner", () => {
    const b = {
      ...newBlock("video"),
      layout: "free" as const,
      x: 100,
      y: 50,
      width: 300,
      height: 150,
      rotation: 35,
      keepAspect: true,
    };
    const next = gestureBlock(b, 70, 90, 4, 200, 128, "se");
    expect(next.width / next.height).toBeCloseTo(2);
    expect(next.width).toBeGreaterThan(300);
  });
  it("groups mixed types in world coordinates, transforms atomically and preserves children on ungroup", () => {
    const p = fixture(),
      g = groupBlocks(p, ["text", "photo"]);
    expect(g.groups).toHaveLength(1);
    expect(g.blocks.every(isFree)).toBe(true);
    for (const b of p.blocks)
      expect(
        logicalRect(
          g.blocks.find((x) => x.id === b.id)!,
          p.page,
        ),
      ).toEqual(logicalRect(b, p.page));
    const box = selectionBox(g, ["text", "photo"])!,
      moved = transformSelection(g, ["text", "photo"], box, {
        ...box,
        x: box.x + 70,
        y: box.y - 20,
      });
    expect(moved.blocks[0].x).toBeCloseTo(g.blocks[0].x + 70);
    expect(moved.blocks[1].y).toBeCloseTo(g.blocks[1].y - 20);
    const scaled = transformSelection(g, ["text", "photo"], box, {
      ...box,
      width: box.width * 1.5,
      height: box.height * 1.5,
    });
    expect(scaled.blocks[1].width).toBeCloseTo(g.blocks[1].width * 1.5);
    const rotated = transformSelection(g, ["text", "photo"], box, {
      ...box,
      rotation: 90,
    });
    expect(rotated.blocks.every((b) => b.rotation === 90)).toBe(true);
    const saved = parseProject(JSON.stringify(rotated));
    expect(saved.groups).toEqual(g.groups);
    expect(saved.blocks).toEqual(rotated.blocks);
    const ungrouped = ungroupBlocks(saved, g.groups![0].id);
    expect(ungrouped.groups).toHaveLength(0);
    expect(ungrouped.blocks.every((b) => !b.groupId)).toBe(true);
    expect(ungrouped.blocks.map((b) => [b.x, b.y, b.rotation])).toEqual(
      rotated.blocks.map((b) => [b.x, b.y, b.rotation]),
    );
  });
  it("protects a whole group if one child is locked and duplicates into a separate unlocked group", () => {
    const g = groupBlocks(fixture(), ["text", "photo"]);
    g.blocks[0].locked = true;
    const box = selectionBox(g, ["text", "photo"])!;
    expect(
      transformSelection(g, ["text", "photo"], box, { ...box, x: 400 }),
    ).toBe(g);
    const copy = duplicateSelection(g, ["text", "photo"]);
    expect(copy.ids).toHaveLength(2);
    expect(copy.project.groups).toHaveLength(2);
    expect(
      copy.project.blocks
        .filter((b) => copy.ids.includes(b.id))
        .every((b) => !b.locked && b.groupId !== g.groups![0].id),
    ).toBe(true);
  });
  it("moves group stacking as a unit without altering child geometry", () => {
    const g = groupBlocks(fixture(), ["text", "photo"]);
    g.blocks.push({ ...newBlock("decoration"), id: "outside", layer: 2 });
    const moved = moveLayer(g, "text", "front");
    expect(orderedLayers(moved.blocks).map((b) => b.id)).toEqual([
      "outside",
      "text",
      "photo",
    ]);
    expect(moved.blocks.map((b) => [b.x, b.y, b.row, b.col])).toEqual(
      g.blocks.map((b) => [b.x, b.y, b.row, b.col]),
    );
  });
  it("undo/redo restores each layout, grouping and transform operation exactly", () => {
    const p = fixture();
    let h = { past: [], present: p, future: [] } as Parameters<
      typeof historyReducer
    >[0];
    const stages = [switchLayout(p, "text", "free")];
    stages.push(groupBlocks(stages[0], ["text", "photo"]));
    const box = selectionBox(stages[1], ["text", "photo"])!;
    stages.push(
      transformSelection(stages[1], ["text", "photo"], box, {
        ...box,
        rotation: 45,
      }),
    );
    stages.push(ungroupBlocks(stages[2], stages[2].groups![0].id));
    for (const stage of stages)
      h = historyReducer(h, { type: "change", update: stage });
    for (const expected of [stages[2], stages[1], stages[0], p]) {
      h = historyReducer(h, { type: "undo" });
      expect(h.present).toEqual(expected);
    }
    for (const expected of stages) {
      h = historyReducer(h, { type: "redo" });
      expect(h.present).toEqual(expected);
    }
  });
  it("reads legacy JSON without adding metadata and rejects dangling group references", () => {
    const p = fixture();
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    expect(() =>
      parseProject(
        JSON.stringify({
          ...p,
          blocks: [{ ...p.blocks[0], layout: "free", groupId: "missing" }],
        }),
      ),
    ).toThrow("групп");
  });
});

it('ignores dormant grid rotation during grouping and separates block/group ID namespaces',()=>{
 const p=fixture();p.blocks[0].rotation=150;
 const g=groupBlocks(p,['text','photo']);expect(g.blocks[0].rotation).toBe(0);
 const groupId=g.groups![0].id;g.blocks.push({...newBlock('decoration'),id:groupId,layer:2});
 const moved=moveLayer(g,'text','front');expect(orderedLayers(moved.blocks).map(b=>b.id)).toEqual([groupId,'text','photo']);
});
