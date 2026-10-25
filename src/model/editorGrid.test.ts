import { it, expect } from "vitest";
import { editorGrid } from "./editorGrid";
it("uses dark grid strokes on light pages and bright strokes on dark pages", () => {
  for (const bg of ["#ffffff", "#FAF7F9", "#ffb2d7", "#aaa"])
    expect(editorGrid(bg, false, "auto").line).toContain("32,14,31");
  for (const bg of ["#000000", "#07070a", "#E0163B"])
    expect(editorGrid(bg, false, "auto").line).toContain("255,225,242");
});
it("manual controls override the background and complex images retain a contrasting halo", () => {
  expect(editorGrid("#fff", true, "auto").halo).toContain("0,0,0");
  expect(editorGrid("#fff", false, "light").line).toContain("255,225,242");
  expect(editorGrid("#000", false, "dark").line).toContain("32,14,31");
});
