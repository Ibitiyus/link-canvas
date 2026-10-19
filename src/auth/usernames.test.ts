import { expect, it } from "vitest";
import { safeReturnPath, usernameError } from "./usernames";
it.each(["admin", "dashboard", "storage", "supabase", "zin"])(
  "reserves system names: %s",
  (value) => expect(usernameError(value)).not.toBe(""),
);
it.each(["ab", "Name", "имя", "_hello", "hello-world", "a".repeat(31)])(
  "rejects invalid names: %s",
  (value) => expect(usernameError(value)).not.toBe(""),
);
it.each(["alice", "art_2026", "user123"])("accepts valid names: %s", (value) =>
  expect(usernameError(value)).toBe(""),
);
it.each([
  "https://evil.test",
  "//evil.test",
  "javascript:alert(1)",
  "/u/someone",
  null,
])("rejects login return redirects: %s", (value) =>
  expect(safeReturnPath(value)).toBe("/dashboard"),
);
it("returns to the existing project editor after login", () =>
  expect(safeReturnPath("/editor")).toBe("/editor"));
