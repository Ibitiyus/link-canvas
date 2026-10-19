import { describe, expect, it } from "vitest";
import { arrange } from "./grid";
import { demoProject, newBlock } from "./defaults";
import {
  parseProject,
  readProject,
  STORAGE_KEY,
  writeProject,
} from "./storage";
import { videoSource, safeUrl } from "./media";

describe("versioned persistence", () => {
  it("round-trips all block types, geometry, layer order and page settings", () => {
    const project = demoProject();
    project.blocks.push(
      ...(
        ["image", "gif", "video", "audio", "qrcode", "decoration"] as const
      ).map((type) => newBlock(type)),
    );
    const normalized = parseProject(JSON.stringify(project));
    const values = new Map<string, string>();
    writeProject(
      {
        setItem: (key, value) => {
          values.set(key, value);
        },
      },
      normalized,
    );
    expect(readProject({ getItem: (key) => values.get(key) ?? null })).toEqual(
      normalized,
    );
    expect(values.has(STORAGE_KEY)).toBe(true);
  });
  it("does not invent data when storage is empty", () =>
    expect(readProject({ getItem: () => null })).toBeNull());
  it("rejects damaged JSON and future versions", () => {
    expect(() => parseProject("{")).toThrow();
    expect(() => parseProject(JSON.stringify({ version: 2 }))).toThrow(
      "Версия",
    );
  });
  it("rejects duplicate IDs", () => {
    const project = demoProject();
    project.blocks.push(project.blocks[0]);
    expect(() => parseProject(JSON.stringify(project))).toThrow("уникальными");
  });
  it("propagates quota errors so the UI can report a failed save", () => {
    expect(() =>
      writeProject(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        demoProject(),
      ),
    ).toThrow("quota");
  });
});
describe("safe media", () => {
  it("blocks executable and relative URL schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("/relative")).toBeNull();
  });
  it.each([
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
  ])("embeds %s on the fixed YouTube host", (value) => {
    expect(videoSource(value)).toEqual({
      kind: "youtube",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });
  it("accepts direct files with query strings", () =>
    expect(videoSource("https://example.com/movie.webm?token=x")?.kind).toBe(
      "file",
    ));
  it("rejects deceptive hosts and unsupported URLs", () => {
    expect(
      videoSource("https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
    expect(videoSource("https://example.com/page")).toBeNull();
  });
});

it("restores rows expanded by collision redistribution beyond the direct input limit", () => {
  const project = demoProject();
  project.blocks = arrange(
    Array.from({ length: 30 }, (_, i) => ({
      ...newBlock("text"),
      id: String(i),
      row: 2000,
      col: 0,
      colSpan: 4,
      rowSpan: 12,
    })),
    4,
    "29",
  );
  expect(parseProject(JSON.stringify(project))).toEqual(project);
});
