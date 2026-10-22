import { expect, it } from "vitest";
import { safeUrl, videoSource } from "../model/media";
import { safeImageSource } from "../model/assets";
import { cloudError } from "./errors";
import {
  actionBody,
  publicError,
  readBytes,
} from "../../supabase/functions/page-actions/safety";
it("rejects executable protocols, SVG data and embedded credentials", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:x",
    "blob:https://example.com/a",
    "https://alice:secret@example.com",
  ])
    expect(safeUrl(url)).toBeNull();
  expect(safeImageSource("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  expect(
    videoSource("https://youtube.com.evil.test/embed/dQw4w9WgXcQ"),
  ).toBeNull();
  expect(videoSource("https://youtu.be/dQw4w9WgXcQ")).toEqual({
    kind: "youtube",
    src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  });
});
it("does not leak database messages or Russian server internals", () => {
  const error = new Error("SQL: relation secret schema private");
  expect(publicError(error)).toBe("REQUEST_FAILED");
  expect(publicError(new Error("REVISION_CONFLICT"))).toBe("REVISION_CONFLICT");
  expect(
    cloudError({ message: "Ошибка SQL таблицы «private», ключ secret" }),
  ).not.toContain("secret");
  expect(cloudError(new Error("Локальная копия сохранена."))).toBe(
    "Локальная копия сохранена.",
  );
});
it("bounds streamed input even without a content length header", async () => {
  const request = new Request("https://zin.test", {
    method: "POST",
    body: JSON.stringify({ action: "cleanup", padding: "x".repeat(20000) }),
  });
  await expect(actionBody(request)).rejects.toThrow("REQUEST_TOO_LARGE");
  expect(
    (await readBytes(new Response(new Uint8Array(100000)), 64)).length,
  ).toBe(64);
});
it("rejects malformed bodies and revisions instead of forwarding them to RPC", async () => {
  for (const body of [
    "null",
    "[]",
    "{}",
    '{"action":"publish","revision":"1"}',
    '{"action":"publish","revision":-1}',
    '{"action":"complete-upload","path":"../someone/file"}',
  ])
    await expect(
      actionBody(new Request("https://zin.test", { method: "POST", body })),
    ).rejects.toThrow("INVALID_REQUEST");
});
