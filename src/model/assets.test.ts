/// <reference types="node" />
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { dataUrlMime, safeImageSource, imageMime, fontMime } from "./assets";
import { demoProject, newBlock } from "./defaults";
import { parseProject } from "./storage";
import { resolveBlockFont } from "./fonts";
const gif = `data:image/gif;base64,${readFileSync("public/demo/signal.gif").toString("base64")}`;
const font = `data:font/woff2;base64,${readFileSync("node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2").toString("base64")}`;
describe("embedded assets", () => {
  it("restores embedded images longer than the old URL limit in every image field", () => {
    expect(gif.length).toBeGreaterThan(2048);
    const project = demoProject();
    project.page.backgroundImage = gif;
    project.blocks = ["image", "gif", "link", "decoration", "video"].map(
      (type) => ({
        ...newBlock(type as "image"),
        url: type === "image" || type === "gif" ? gif : "https://example.com",
        imageUrl: gif,
      }),
    );
    const restored = parseProject(JSON.stringify(project));
    expect(restored.page.backgroundImage).toBe(gif);
    expect(restored.blocks.every((block) => block.imageUrl === gif)).toBe(true);
    expect(restored.blocks[0].url).toBe(gif);
  });
  it("round-trips font files and per-block font choices with version 1", () => {
    const project = {
      ...demoProject(),
      customFonts: [{ id: "local-font", name: "My Font", dataUrl: font }],
    };
    project.blocks[0].fontFamily = "font:local-font";
    expect(parseProject(JSON.stringify(project))).toEqual(project);
    expect(resolveBlockFont("font:local-font")).toContain("LCFont-local-font");
    expect(resolveBlockFont("georgia")).toBe("Georgia, serif");
    expect(resolveBlockFont()).toBeUndefined();
  });
  it("rejects SVG/HTML, mismatched MIME types and transient blob URLs", () => {
    expect(safeImageSource("data:image/svg+xml;base64,PHN2Zy8+")).toBeNull();
    expect(safeImageSource("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeImageSource(gif.replace("image/gif", "image/png"))).toBeNull();
    expect(safeImageSource("blob:https://example.com/local-only")).toBeNull();
    expect(safeImageSource("https://example.com/image.png")).toBe(
      "https://example.com/image.png",
    );
  });
  it("recognizes files by bytes and keeps fonts separate from image content", () => {
    expect(imageMime(new Uint8Array([255, 216, 255]))).toBe("image/jpeg");
    expect(imageMime(new Uint8Array(Buffer.from("not an image")))).toBeNull();
    expect(fontMime(new Uint8Array(Buffer.from("wOF2")))).toBe("font/woff2");
    expect(dataUrlMime(font, "image")).toBeNull();
    expect(dataUrlMime(gif, "font")).toBeNull();
  });
  it("rejects missing font references and duplicate imported font IDs", () => {
    const project = demoProject();
    project.blocks[0].fontFamily = "font:missing";
    expect(() => parseProject(JSON.stringify(project))).toThrow("шрифт");
    delete project.blocks[0].fontFamily;
    expect(() =>
      parseProject(
        JSON.stringify({
          ...project,
          customFonts: [
            { id: "font", name: "One", dataUrl: font },
            { id: "font", name: "Two", dataUrl: font },
          ],
        }),
      ),
    ).toThrow("идентификатор");
  });
});

it("round-trips local file references, music and decorations outside the grid", () => {
  const project = demoProject();
  project.customFonts = [
    { id: "font", name: "Local", dataUrl: "asset:font-file" },
  ];
  project.page.backgroundImage = "asset:background";
  project.blocks = [
    { ...newBlock("audio"), url: "asset:track", imageUrl: "asset:cover" },
    { ...newBlock("video"), col: 2, url: "asset:clip" },
    {
      ...newBlock("decoration"),
      x: -200,
      y: -300,
      width: 2000,
      height: 2400,
      rotation: 0,
    },
  ];
  expect(parseProject(JSON.stringify(project))).toEqual(project);
});
