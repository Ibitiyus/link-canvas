import { expect, it } from "vitest";
import { newBlock, emptyProject } from "../model/defaults";
import { mapProjectSources, projectSources } from "./projectAssets";
import { parseProject } from "../model/storage";
it("rewrites every file slot while preserving links, QR targets and literal user text", () => {
  const project = emptyProject();
  project.page.backgroundImage = "asset:bg";
  project.customFonts = [{ id: "font", name: "Font", dataUrl: "asset:font" }];
  project.blocks = [
    { ...newBlock("image"), url: "asset:image" },
    { ...newBlock("audio"), url: "asset:audio", imageUrl: "asset:cover" },
    { ...newBlock("text"), content: "asset:literal" },
    { ...newBlock("link"), url: "https://example.com/asset:link" },
    { ...newBlock("qrcode"), url: "https://example.com/asset:qr" },
  ];
  const mapped = mapProjectSources(project, (s) =>
    s.replace(/^asset:/, "mapped:"),
  );
  expect(projectSources(mapped)).toEqual([
    "mapped:bg",
    "mapped:font",
    "mapped:image",
    "mapped:cover",
    "mapped:audio",
  ]);
  expect(mapped.blocks[2].content).toBe("asset:literal");
  expect(mapped.blocks[3].url).toBe(project.blocks[3].url);
  expect(mapped.blocks[4].url).toBe(project.blocks[4].url);
});
it("restores private cloud sources and public fonts without changing format version 1", () => {
  const ref =
    "cloud:12345678-1234-1234-1234-123456789abc/12345678-1234-1234-1234-123456789def.woff2";
  const project = emptyProject();
  project.customFonts = [
    { id: "cloud-font", name: "Cloud Font", dataUrl: ref },
    {
      id: "public-font",
      name: "Published Font",
      dataUrl: "https://example.com/storage/font.woff2",
    },
  ];
  expect(parseProject(JSON.stringify(project))).toEqual(project);
});
