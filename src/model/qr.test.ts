import { describe, expect, it } from "vitest";
import { createQR } from "./qr";

describe("QR links", () => {
  it.each([
    "https://example.com/path?hello=world&next=1#section",
    "http://192.168.0.224:5173/preview",
    "https://пример.рф/музыка?название=привет 🎵",
  ])(
    "normalizes the URL consistently for encoding and navigation: %s",
    (value) => {
      const result = createQR(value);
      expect(result.error).toBeUndefined();
      expect(result.path).toBeTruthy();
      expect(result.url).toBe(new URL(value).href);
    },
  );
  it.each([
    "",
    "javascript:alert(1)",
    "data:text/html,hi",
    "/relative",
    "not a link",
  ])("rejects invalid links: %s", (value) => {
    const result = createQR(value);
    expect(result.error).toContain("корректную ссылку");
    expect(result.url).toBeUndefined();
  });
  it("handles an address beyond QR capacity without throwing", () => {
    expect(createQR(`https://example.com/${"я".repeat(2000)}`).error).toContain(
      "слишком длинная",
    );
  });
});
