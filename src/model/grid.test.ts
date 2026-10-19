import { describe, expect, it } from "vitest";
import { newBlock } from "./defaults";
import { arrange, editBlock, firstFree, gridRows, overlaps } from "./grid";
import { emptyProject } from "./defaults";

const block = (id: string, col = 0, row = 0, colSpan = 1, rowSpan = 1) => ({
  ...newBlock("text"),
  id,
  col,
  row,
  colSpan,
  rowSpan,
});
function expectValid(blocks: ReturnType<typeof block>[], columns: number) {
  const grid = blocks.filter((b) => b.type !== "decoration");
  for (const item of grid) {
    expect(item.col).toBeGreaterThanOrEqual(0);
    expect(item.col + item.colSpan).toBeLessThanOrEqual(columns);
  }
  for (let i = 0; i < grid.length; i++)
    for (let j = i + 1; j < grid.length; j++)
      expect(overlaps(grid[i], grid[j])).toBe(false);
}
describe("grid placement", () => {
  it("allows adjacent cells without overlap", () =>
    expect(overlaps(block("a"), block("b", 1))).toBe(false));
  it("finds space for a new block on the next row", () => {
    const result = firstFree(
      block("new", 0, 0, 2),
      [block("full", 0, 0, 4)],
      4,
    );
    expect([result.col, result.row]).toEqual([0, 1]);
  });
  it("gives the moved block priority and redistributes occupied cells", () => {
    const project = { ...emptyProject(), blocks: [block("a"), block("b", 1)] };
    const result = editBlock(project, "a", { col: 1 });
    expect(result.blocks[0].col).toBe(1);
    expectValid(result.blocks, 4);
    expect(result.blocks[1].col).toBe(0);
  });
  it("resizes and cascades collisions without losing blocks", () => {
    const blocks = [block("a"), block("b", 1), block("c", 2), block("d", 3)];
    const result = editBlock({ ...emptyProject(), blocks }, "a", {
      colSpan: 4,
      rowSpan: 2,
    });
    expect(result.blocks[0].rowSpan).toBe(2);
    expect(result.blocks.slice(1).every((b) => b.row >= 2)).toBe(true);
    expectValid(result.blocks, 4);
  });
  it("reflows when column count decreases", () =>
    expectValid(arrange([block("a", 0, 0, 4), block("b", 3, 1, 2)], 3), 3));
  it("ignores decorations when calculating occupied cells", () => {
    const decoration = { ...newBlock("decoration"), id: "decor" };
    const result = arrange([decoration, block("a")], 3);
    expect(result[0]).toEqual(decoration);
    expect(result[1].row).toBe(0);
  });
  it("grows rows with content", () =>
    expect(gridRows([block("a", 0, 9, 1, 3)])).toBe(13));
  it("clamps negative positions and oversized blocks", () => {
    const result = arrange([block("a", -4, -3, 9, 30)], 3);
    expect(result[0]).toMatchObject({
      col: 0,
      row: 0,
      colSpan: 3,
      rowSpan: 12,
    });
  });
  it("keeps a dense sequence of repeated moves, resizes and column changes valid", () => {
    let project = {
      ...emptyProject(),
      blocks: Array.from({ length: 30 }, (_, i) =>
        block(String(i), i % 4, Math.floor(i / 4)),
      ),
    };
    for (let i = 0; i < 120; i++) {
      project = editBlock(project, String(i % 30), {
        col: i % 5,
        row: i % 10,
        colSpan: (i % 4) + 1,
        rowSpan: (i % 3) + 1,
      });
      expectValid(project.blocks, project.page.columns);
    }
  });
});

it("allows free decorations beyond every grid edge without displacing grid blocks", () => {
  const decoration = { ...newBlock("decoration"), x: 850, width: 200 };
  expect(decoration.rotation).toBe(0);
  const project = { ...emptyProject(), blocks: [decoration, block("grid")] };
  const result = editBlock(project, decoration.id, {
    x: -150,
    y: -120,
    width: 1400,
    height: 2500,
  });
  expect(result.blocks[0]).toMatchObject({
    x: -150,
    y: -120,
    width: 1400,
    height: 2500,
  });
  expect(result.blocks[1]).toEqual(project.blocks[1]);
});
