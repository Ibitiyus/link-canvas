import { afterEach, expect, it, vi } from "vitest";
import { createId } from "./id";
afterEach(() => vi.unstubAllGlobals());
it("creates unique IDs without the secure-context-only randomUUID method", () => {
  const actual = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: actual.getRandomValues.bind(actual),
  });
  const ids = Array.from({ length: 100 }, createId);
  expect(new Set(ids).size).toBe(100);
  expect(ids[0]).toMatch(
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
  );
});
it("still creates local IDs if Web Crypto is completely unavailable", () => {
  vi.stubGlobal("crypto", undefined);
  const ids = Array.from({ length: 100 }, createId);
  expect(new Set(ids).size).toBe(100);
});
