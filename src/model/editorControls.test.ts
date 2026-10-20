import { expect, it } from "vitest";
import { emptyProject, newBlock } from "./defaults";
import { editBlock, arrange, overlaps } from "./grid";
import { moveLayer, orderedLayers } from "./layers";
import { gestureBlock, RESIZE_EDGES } from "./gestures";
import { parseProject } from "./storage";
it("migrates legacy stacking without changing JSON or geometry, then moves decor below a grid block", () => {
  const grid = { ...newBlock("text"), id: "grid" },
    decor = { ...newBlock("decoration"), id: "decor" };
  const project = { ...emptyProject(), blocks: [grid, decor] },
    before = JSON.stringify(project);
  expect(orderedLayers(project.blocks).map((b) => b.id)).toEqual([
    "grid",
    "decor",
  ]);
  const result = moveLayer(project, "decor", "back");
  expect(orderedLayers(result.blocks).map((b) => b.id)).toEqual([
    "decor",
    "grid",
  ]);
  expect(result.blocks.map((b) => [b.id, b.col, b.row, b.x, b.y])).toEqual(
    project.blocks.map((b) => [b.id, b.col, b.row, b.x, b.y]),
  );
  expect(JSON.stringify(project)).toBe(before);
  expect(
    orderedLayers(parseProject(JSON.stringify(result)).blocks).map((b) => b.id),
  ).toEqual(["decor", "grid"]);
});
it("protects every locked geometry field while content and visibility remain editable", () => {
  for (const type of ["text", "decoration"] as const) {
    const block = { ...newBlock(type), locked: true },
      project = { ...emptyProject(), blocks: [block] };
    const changed = editBlock(project, block.id, {
      col: 3,
      row: 20,
      colSpan: 4,
      rowSpan: 6,
      x: 400,
      y: 300,
      width: 800,
      height: 600,
      rotation: 90,
      content: "new",
      hidden: true,
    });
    for (const key of [
      "col",
      "row",
      "colSpan",
      "rowSpan",
      "x",
      "y",
      "width",
      "height",
      "rotation",
    ] as const)
      expect(changed.blocks[0][key]).toBe(block[key]);
    expect(changed.blocks[0].content).toBe("new");
    expect(changed.blocks[0].hidden).toBe(true);
    expect(gestureBlock(block, 100, 100, 4, 200, 128, "se")).toEqual(block);
  }
});
it("never redistributes locked neighbors when an unlocked block expands", () => {
  const fixed = {
    ...newBlock("text"),
    id: "fixed",
    locked: true,
    col: 2,
    colSpan: 2,
    row: 0,
  };
  const free = { ...newBlock("link"), id: "free", col: 0, row: 0 };
  const p = editBlock({ ...emptyProject(), blocks: [free, fixed] }, "free", {
    colSpan: 4,
  });
  expect(p.blocks.find((b) => b.id === "fixed")).toEqual(fixed);
  expect(overlaps(p.blocks[0], p.blocks[1])).toBe(false);
});
it.each(RESIZE_EDGES)(
  "snaps %s resize and preserves valid grid bounds",
  (edge) => {
    const block = {
      ...newBlock("text"),
      col: 1,
      row: 2,
      colSpan: 2,
      rowSpan: 2,
    };
    const result = gestureBlock(block, -1000, -1000, 4, 200, 128, edge);
    expect(result.col).toBeGreaterThanOrEqual(0);
    expect(result.row).toBeGreaterThanOrEqual(0);
    expect(result.colSpan).toBeGreaterThanOrEqual(1);
    expect(result.rowSpan).toBeGreaterThanOrEqual(1);
    expect(result.rowSpan).toBeLessThanOrEqual(12);
    expect(result.col + result.colSpan).toBeLessThanOrEqual(4);
  },
);
it("keeps the opposite rotated corner fixed when resizing decor", () => {
  const block = {
    ...newBlock("decoration"),
    x: 120,
    y: 100,
    width: 200,
    height: 100,
    rotation: 35,
  };
  const opposite = (b: typeof block) => {
    const a = (b.rotation * Math.PI) / 180;
    return {
      x:
        b.x +
        b.width / 2 -
        (b.width / 2) * Math.cos(a) +
        (b.height / 2) * Math.sin(a),
      y:
        b.y +
        b.height / 2 -
        (b.width / 2) * Math.sin(a) -
        (b.height / 2) * Math.cos(a),
    };
  };
  const next = gestureBlock(block, 100, 70, 4, 200, 128, "se");
  expect(opposite(next).x).toBeCloseTo(opposite(block).x);
  expect(opposite(next).y).toBeCloseTo(opposite(block).y);
});
it("preserves optional locks/visibility/layers through the v1 reader", () => {
  const p = {
    ...emptyProject(),
    blocks: [
      { ...newBlock("decoration"), locked: true, hidden: true, layer: 0 },
    ],
  };
  expect(parseProject(JSON.stringify(p)).blocks[0]).toMatchObject({
    locked: true,
    hidden: true,
    layer: 0,
  });
  const legacy = parseProject(
    JSON.stringify({ ...emptyProject(), blocks: [newBlock("text")] }),
  );
  expect(legacy.blocks[0].locked ?? false).toBe(false);
  expect(legacy.blocks[0].hidden ?? false).toBe(false);
});
