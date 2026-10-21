import { expect, it, vi } from "vitest";
import { emptyProject, newBlock } from "../model/defaults";
const spies = vi.hoisted(() => ({ abort: vi.fn() }));
vi.mock("tus-js-client", () => ({
  DefaultHttpStack: class {},
  Upload: class {
    constructor(
      _blob: Blob,
      private options: { onError: (error: Error) => void },
    ) {}
    start() {
      queueMicrotask(() =>
        this.options.onError(new Error("network upload failed")),
      );
    }
    abort() {
      spies.abort();
      return Promise.resolve();
    }
  },
}));
vi.mock("./config", () => ({
  cloudUrl: "http://127.0.0.1:54321",
  cloudKey: "fake",
  maxCloudFileBytes: 50000000,
  ownerClient: () => ({
    rpc: async () => ({ data: "owner/file.png", error: null }),
  }),
  requireCloud: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "owner" }, access_token: "fake" } },
      }),
    },
  }),
}));
vi.mock("../model/fileStore", () => ({
  isAssetRef: (value: string) => value.startsWith("asset:"),
  getFile: async () => ({ blob: new Blob(["image"], { type: "image/png" }) }),
}));
import { uploadProject } from "./assets";
it("failed uploads release abort closures instead of retaining their blobs until logout", async () => {
  const controller = new AbortController();
  const removed = vi.spyOn(controller.signal, "removeEventListener");
  const project = emptyProject();
  project.blocks = [{ ...newBlock("image"), url: "asset:file" }];
  await expect(
    uploadProject(project, "owner", new Map(), controller.signal, () => {}),
  ).rejects.toThrow("network upload failed");
  expect(removed).toHaveBeenCalledWith("abort", expect.any(Function));
  controller.abort();
  expect(spies.abort).not.toHaveBeenCalled();
});
