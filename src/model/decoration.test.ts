import { expect, it } from "vitest";
import { newBlock } from "./defaults";
import { decorationBounds } from "./decoration";
it("reserves the rotated bounds outside the grid at the rendered scale", () => {
  const block = {
    ...newBlock("decoration"),
    x: -200,
    y: -80,
    width: 200,
    height: 100,
    rotation: 90,
  };
  const bounds = decorationBounds(block, 0.5);
  expect(bounds.left).toBeCloseTo(-75);
  expect(bounds.right).toBeCloseTo(-25);
  expect(bounds.top).toBeCloseTo(-65);
  expect(bounds.bottom).toBeCloseTo(35);
});
it("includes both sides of a rotated wide element", () => {
  const bounds = decorationBounds(
    {
      ...newBlock("decoration"),
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      rotation: 90,
    },
    1,
  );
  expect(bounds.left).toBeCloseTo(50);
  expect(bounds.right).toBeCloseTo(150);
  expect(bounds.top).toBeCloseTo(-50);
  expect(bounds.bottom).toBeCloseTo(150);
});
