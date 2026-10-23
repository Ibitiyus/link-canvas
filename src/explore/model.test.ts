import { describe, it, expect } from "vitest";
import { CATEGORIES, isCover, parseGallery, presentationError } from "./model";
const cover = "data:image/jpeg;base64," + btoa("\xff\xd8\xff\x00\xff\xd9");
const card = {
  username: "test_artist",
  title: "<script>alert(1)</script>",
  description: "Моя страница",
  category: "Art & Design" as const,
  cover: "",
  listed_at: "2026-10-23T10:00:00Z",
  updated_at: "2026-10-23T11:00:00Z",
};
const response = (patch = {}) => ({
  items: [card],
  has_more: false,
  next_offset: 12,
  ...patch,
});
describe("Explore bounded public projection", () => {
  it("accepts all nine categories without mutating input", () => {
    for (const category of CATEGORIES)
      expect(presentationError({ ...card, category })).toBe("");
  });
  it("preserves text as text, removes unsolicited private fields/media", () => {
    const result = parseGallery(
      response({
        items: [
          {
            ...card,
            owner_id: "secret",
            email: "private@example.test",
            project: { blocks: [] },
            video: "https://evil.test/a.mp4",
          },
        ],
      }),
    );
    expect(result.items[0]).toEqual(card);
    expect(result.items[0].title).toContain("<script>");
  });
  it("validates title/description boundaries including unicode", () => {
    expect(presentationError({ ...card, title: " " })).toMatch("Название");
    expect(presentationError({ ...card, title: "🎵".repeat(80) })).toBe("");
    expect(presentationError({ ...card, title: "я".repeat(81) })).toMatch(
      "Название",
    );
    expect(
      presentationError({ ...card, description: "x".repeat(281) }),
    ).toMatch("Описание");
  });
  it("accepts only bounded inline JPEG covers, never remote/GIF/SVG", () => {
    expect(isCover(cover)).toBe(true);
    for (const value of [
      "https://example.test/x.jpg",
      "data:image/gif;base64,R0lGODlh",
      "data:image/svg+xml;base64,PHN2Zz4=",
      "javascript:alert(1)",
      "blob:test",
      null,
      "data:image/jpeg;base64,broken",
      cover + "A",
    ])
      expect(isCover(value)).toBe(false);
    expect(
      isCover(
        "data:image/jpeg;base64," +
          btoa("\xff\xd8\xff" + "x".repeat(65536) + "\xff\xd9"),
      ),
    ).toBe(false);
  });
  it("rejects invalid public rows instead of rendering unsafe links/media", () => {
    for (const patch of [
      { username: "../../editor" },
      { username: "x" },
      { category: "hack" },
      { cover: "https://tracker.test/a.gif" },
      { title: 25 },
      { description: null },
      { listed_at: "bad" },
      { updated_at: undefined },
    ])
      expect(() =>
        parseGallery(response({ items: [{ ...card, ...patch }] })),
      ).toThrow();
  });
  it("bounds results and paging, including empty and last page", () => {
    expect(parseGallery(response({ items: [] })).items).toEqual([]);
    expect(
      parseGallery(response({ has_more: true, next_offset: 10008 })).has_more,
    ).toBe(false);
    for (const value of [
      null,
      {},
      response({ items: Array(25).fill(card) }),
      response({ has_more: "true" }),
      response({ next_offset: -1 }),
      response({ next_offset: Infinity }),
    ])
      expect(() => parseGallery(value)).toThrow();
  });
});
