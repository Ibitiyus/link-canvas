import { expect, it } from "vitest";
import { canvasExtent, fitCanvas } from "./canvasLayout";
import { newBlock } from "./defaults";
it("fits a fixed composition without increasing it on wide screens", () => {
  for (const available of [1440, 1024, 768, 390, 320]) {
    const scale = fitCanvas(available, 960);
    expect(scale).toBe(Math.min(1, available / 960));
    expect(960 * scale).toBeLessThanOrEqual(available);
  }
});
it("includes rotated negative and lower/right decoration without mutating it", () => {
  const decor = {
    ...newBlock("decoration"),
    x: -80,
    y: -60,
    width: 120,
    height: 80,
    rotation: 30,
  };
  const lower = { ...decor, id: "lower", x: 1100, y: 900 };
  const original = JSON.stringify([decor, lower]);
  const extent = canvasExtent(960, 400, [decor, lower]);
  expect(extent.left).toBeGreaterThan(0);
  expect(extent.top).toBeGreaterThan(0);
  expect(extent.width).toBeGreaterThan(1200);
  expect(extent.height).toBeGreaterThan(980);
  expect(extent.width * fitCanvas(320, extent.width)).toBeCloseTo(320);
  expect(JSON.stringify([decor, lower])).toBe(original);
});
it("keeps ordinary page bounds exact and recalculates the bottom after content changes", () => {
  expect(canvasExtent(960, 480, [])).toEqual({
    left: 0,
    top: 0,
    width: 960,
    height: 480,
  });
  expect(canvasExtent(960, 1200, []).height).toBe(1200);
  expect(fitCanvas(0, 960)).toBe(0);
});
