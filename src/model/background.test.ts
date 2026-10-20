import { expect, it } from "vitest";
import {
  backgroundTransparency,
  withBackgroundTransparency,
} from "./background";
import { emptyProject, newBlock } from "./defaults";
import { parseProject } from "./storage";
it("supports opaque legacy colors and existing alpha without changing RGB", () => {
  expect(backgroundTransparency("#abcdef")).toBe(0);
  expect(backgroundTransparency("#abcdef00")).toBe(100);
  expect(backgroundTransparency("#abcdef80")).toBe(50);
  expect(withBackgroundTransparency("#abcdef80", 100)).toBe("#abcdef00");
  expect(withBackgroundTransparency("#abcdef00", 0)).toBe("#abcdef");
  expect(withBackgroundTransparency("#abcdef", 50)).toBe("#abcdef80");
});
it("round trips background transparency for every v1 block without changing content opacity", () => {
  const project = emptyProject();
  project.blocks = [
    "link",
    "text",
    "image",
    "gif",
    "video",
    "audio",
    "qrcode",
    "decoration",
  ].map((type) => ({
    ...newBlock(type as Parameters<typeof newBlock>[0]),
    background: "#12345640",
    opacity: 0.75,
  }));
  const restored = parseProject(JSON.stringify(project));
  expect(restored.version).toBe(1);
  for (const block of restored.blocks) {
    expect(block.background).toBe("#12345640");
    expect(block.opacity).toBe(0.75);
  }
});
