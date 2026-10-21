const codes = new Set([
  "NOT_AUTHENTICATED",
  "ASSET_NOT_FOUND",
  "ASSET_NOT_READY",
  "FILE_NOT_UPLOADED",
  "UNSUPPORTED_FILE",
  "FILE_TOO_LARGE",
  "PUBLICATION_BUSY",
  "PUBLICATION_CANCELLED",
  "REVISION_CONFLICT",
  "RATE_LIMIT",
  "STORAGE_QUOTA",
  "INVALID_REQUEST",
  "REQUEST_TOO_LARGE",
  "INVALID_PROJECT",
  "INVALID_ASSET_SOURCE",
  "INVALID_EDITOR_FIELDS",
  "INVALID_GROUPS",
  "INVALID_CREATIVE_FIELDS",
  "INVALID_FREE_GEOMETRY",
  "INVALID_EFFECTS",
]);
export function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return codes.has(message) ? message : "REQUEST_FAILED";
}
export async function readBytes(response: Response | Request, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const part = value.subarray(0, limit - length);
      chunks.push(part);
      length += part.length;
      if (length >= limit) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of chunks) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export async function actionBody(request: Request) {
  const bytes = await readBytes(request, 16385);
  if (bytes.length > 16384) throw new Error("REQUEST_TOO_LARGE");
  let body;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("INVALID_REQUEST");
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !["publish", "complete-upload", "cleanup"].includes(body.action)
  )
    throw new Error("INVALID_REQUEST");
  if (
    body.action === "publish" &&
    (!Number.isSafeInteger(body.revision) || body.revision < 1)
  )
    throw new Error("INVALID_REQUEST");
  if (
    body.action === "complete-upload" &&
    (typeof body.path !== "string" ||
      !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(body.path))
  )
    throw new Error("INVALID_REQUEST");
  return body;
}
