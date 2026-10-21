import { describe, it, expect } from "vitest";
import { buildTemplate, freshProject } from "./designs";
import { TEMPLATE_CATALOG } from "./catalog";
import { parseProject } from "../model/storage";
import { isFree } from "../model/placement";
import { overlaps } from "../model/grid";
import { templateName } from "./storage";
describe("real version 1 starter designs", () => {
  for (const t of TEMPLATE_CATALOG)
    it(`${t.name}: validated project with safe owned media and no grid intersections`, () => {
      const p = buildTemplate(t.id, "https://zin.example");
      expect(parseProject(JSON.stringify(p))).toEqual(p);
      const grid = p.blocks.filter((b) => !isFree(b));
      for (let i = 0; i < grid.length; i++)
        for (let j = i + 1; j < grid.length; j++)
          expect(overlaps(grid[i], grid[j])).toBe(false);
      for (const b of p.blocks)
        for (const value of [b.url, b.imageUrl])
          if (
            value &&
            ["image", "gif", "video", "audio", "decoration"].includes(b.type)
          )
            expect(value).toMatch(/^https:\/\/zin\.example\/templates\/v1\//);
      expect(p.blocks.length === 0).toBe(t.id === "blank-canvas");
      const copy = freshProject(p);
      expect(copy.page).toEqual(p.page);
      expect(copy.blocks.map((b) => b.id)).not.toEqual(
        p.blocks.length ? p.blocks.map((b) => b.id) : ["not-empty"],
      );
      expect(parseProject(JSON.stringify(copy))).toEqual(copy);
    });
  it("demonstrates all eight types, groups, multiple grids, free positions, transparency and motion", () => {
    const p = TEMPLATE_CATALOG.map((t) =>
        buildTemplate(t.id, "https://zin.example"),
      ),
      blocks = p.flatMap((p) => p.blocks);
    expect(new Set(blocks.map((b) => b.type)).size).toBe(8);
    expect(new Set(p.map((p) => p.page.columns))).toEqual(new Set([3, 4, 5]));
    expect(p.some((p) => p.groups?.length)).toBe(true);
    expect(blocks.some(isFree)).toBe(true);
    expect(blocks.some((b) => b.background.length === 9)).toBe(true);
    expect(blocks.some((b) => b.effects?.animation?.enabled)).toBe(true);
  });
  it("does not mutate the source, keeps geometry/effects and remaps group and font references", () => {
    const p = buildTemplate("punk-zine", "https://zin.example");
    p.customFonts = [
      {
        id: "font-one",
        name: "Test",
        dataUrl: "https://zin.example/test.woff2",
      },
    ];
    p.blocks[0].fontFamily = "font:font-one";
    const raw = JSON.stringify(p),
      copy = freshProject(p);
    expect(JSON.stringify(p)).toBe(raw);
    expect(copy.groups![0].id).not.toBe(p.groups![0].id);
    expect(
      copy.blocks
        .filter((b) => b.groupId)
        .every((b) => b.groupId === copy.groups![0].id),
    ).toBe(true);
    expect(copy.blocks[0].fontFamily).toBe(`font:${copy.customFonts![0].id}`);
    expect(copy.customFonts![0].id).not.toBe("font-one");
    for (let i = 0; i < p.blocks.length; i++)
      for (const key of [
        "x",
        "y",
        "width",
        "height",
        "rotation",
        "col",
        "row",
        "layer",
        "effects",
      ] as const)
        expect(copy.blocks[i][key]).toEqual(p.blocks[i][key]);
  });
  it("rejects empty and oversized local names", () => {
    expect(() => templateName("  ")).toThrow();
    expect(() => templateName("x".repeat(81))).toThrow();
    expect(templateName("  Мой зин ")).toBe("Мой зин");
  });
});
