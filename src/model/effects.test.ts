import { describe, it, expect } from "vitest";
import {
  ANIMATIONS,
  DEFAULT_ANIMATION,
  DEFAULT_VISUAL,
  parseEffects,
  animationDuration,
} from "./effects";
import { emptyProject, newBlock } from "./defaults";
import { parseProject } from "./storage";
import {
  duplicateSelection,
  groupBlocks,
  selectionBox,
  transformSelection,
} from "./creative";
import { historyReducer } from "../state/history";
import type { BlockType, Project } from "./types";
const effects = {
  animation: { ...DEFAULT_ANIMATION, type: "float" as const },
  hover: "glow" as const,
  visual: { ...DEFAULT_VISUAL, blur: 2, glow: 8 },
};
describe("optional animation and visual metadata", () => {
  for (const type of Object.keys(ANIMATIONS))
    it(`validates ${type}`, () =>
      expect(
        parseEffects({ ...effects, animation: { ...effects.animation, type } })
          .animation?.type,
      ).toBe(type));
  for (const type of [
    "link",
    "text",
    "image",
    "gif",
    "video",
    "audio",
    "qrcode",
    "decoration",
  ] as BlockType[])
    it(`round trips ${type} without changing geometry`, () => {
      const block = {
        ...newBlock(type),
        layout: "free" as const,
        x: -22,
        y: 67,
        width: 220,
        height: 110,
        rotation: 37,
        effects,
      };
      const p = { ...emptyProject(), blocks: [block] };
      expect(parseProject(JSON.stringify(p))).toEqual(p);
    });
  it("keeps exact legacy shape", () => {
    const p = { ...emptyProject(), blocks: [newBlock("text")] };
    expect(parseProject(JSON.stringify(p))).toEqual(p);
    expect(parseProject(JSON.stringify(p)).blocks[0]).not.toHaveProperty(
      "effects",
    );
  });
  for (const invalid of [
    null,
    [],
    { hover: "__proto__" },
    { animation: { ...DEFAULT_ANIMATION, duration: 0.1 } },
    { animation: { ...DEFAULT_ANIMATION, intensity: Infinity } },
    { animation: { ...DEFAULT_ANIMATION, delay: 31 } },
    { animation: { ...DEFAULT_ANIMATION, enabled: "true" } },
    { visual: { ...DEFAULT_VISUAL, blur: 100 } },
    { visual: { ...DEFAULT_VISUAL, hue: 999 } },
  ])
    it(`rejects unsafe ${JSON.stringify(invalid)}`, () =>
      expect(() => parseEffects(invalid)).toThrow());
  it("limits flicker frequency and preserves slow durations", () => {
    expect(
      animationDuration({
        ...DEFAULT_ANIMATION,
        type: "flicker",
        duration: 0.8,
      }),
    ).toBe(2);
    expect(
      animationDuration({ ...DEFAULT_ANIMATION, type: "glitch", duration: 10 }),
    ).toBe(10);
  });
  it("preserves group effects through geometry, duplication, JSON and history", () => {
    let p: Project = {
      ...emptyProject(),
      blocks: [newBlock("text"), { ...newBlock("image"), col: 2 }],
    };
    p = groupBlocks(
      p,
      p.blocks.map((b) => b.id),
    );
    p.groups![0].effects = effects;
    const ids = p.blocks.map((b) => b.id),
      box = selectionBox(p, ids)!;
    const moved = transformSelection(p, ids, box, {
      ...box,
      x: box.x + 40,
      rotation: 25,
    });
    expect(moved.groups![0].effects).toEqual(effects);
    expect(parseProject(JSON.stringify(moved)).groups).toEqual(moved.groups);
    expect(duplicateSelection(p, ids).project.groups![1].effects).toEqual(
      effects,
    );
    let h = historyReducer(
      { past: [], present: p, future: [] },
      { type: "change", update: moved },
    );
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toEqual(p);
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toEqual(moved);
  });
});
