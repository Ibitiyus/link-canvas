import { expect, it, vi } from "vitest";
import { DraftSynchronizer } from "./synchronizer";
import { projectSnapshot } from "./snapshot";
import { emptyProject } from "../model/defaults";
import { RevisionConflict } from "./errors";
const snapshot = () => emptyProject();
it("serializes uploads and drains the latest edit instead of acknowledging an obsolete snapshot", async () => {
  let current = snapshot();
  const initial = projectSnapshot(current);
  current = { ...current, page: { ...current.page, title: "first" } };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saved: number[] = [],
    titles: string[] = [],
    ack: string[] = [];
  const sync = new DraftSynchronizer({
    revision: 1,
    snapshot: initial,
    latest: () => current,
    upload: async (project) => {
      if (project.page.title === "first") await gate;
      return project;
    },
    save: async (project, revision) => {
      saved.push(revision);
      titles.push(project.page.title);
      return {
        owner_id: "owner",
        project,
        revision: revision + 1,
        updated_at: "",
      };
    },
    acknowledged: (_, value) => {
      ack.push(value);
    },
  });
  const first = sync.save();
  current = { ...current, page: { ...current.page, title: "latest" } };
  const second = sync.save();
  release();
  await Promise.all([first, second]);
  expect(saved).toEqual([1, 2]);
  expect(titles).toEqual(["first", "latest"]);
  expect(sync.revision).toBe(3);
  expect(sync.dirty).toBe(false);
  expect(ack.at(-1)).toBe(projectSnapshot(current));
});
it("does not advance a revision or clear dirty state after a server conflict", async () => {
  const project = snapshot(),
    acknowledge = vi.fn();
  const sync = new DraftSynchronizer({
    revision: 5,
    snapshot: "old",
    latest: () => project,
    upload: async (p) => p,
    save: async () => {
      throw new RevisionConflict();
    },
    acknowledged: acknowledge,
  });
  await expect(sync.save()).rejects.toBeInstanceOf(RevisionConflict);
  expect(sync.revision).toBe(5);
  expect(sync.dirty).toBe(true);
  expect(acknowledge).not.toHaveBeenCalled();
});
it("does not save another account's project after stopping an in-flight upload", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const save = vi.fn();
  const sync = new DraftSynchronizer({
    revision: 0,
    snapshot: "",
    latest: snapshot,
    upload: async (p) => {
      await gate;
      return p;
    },
    save,
    acknowledged: vi.fn(),
  });
  const running = sync.save();
  sync.stop();
  release();
  await expect(running).rejects.toThrow("SESSION_CHANGED");
  expect(save).not.toHaveBeenCalled();
});
it("creates an explicitly saved empty page even when no fields changed", async () => {
  const project = snapshot();
  const sync = new DraftSynchronizer({
    revision: 0,
    snapshot: projectSnapshot(project),
    latest: () => project,
    upload: async (p) => p,
    save: async (p, revision) => ({
      owner_id: "owner",
      project: p,
      revision: revision + 1,
      updated_at: "",
    }),
    acknowledged: vi.fn(),
  });
  expect(sync.dirty).toBe(false);
  await sync.save(true);
  expect(sync.revision).toBe(1);
  expect(sync.dirty).toBe(false);
});

// A read from PostgreSQL or the local v1 parser can reorder keys without changing data.
it("does not create a false edit after JSONB reorders object keys", async () => {
  const original = snapshot();
  const reordered = {
    blocks: original.blocks,
    page: { ...original.page, title: original.page.title },
    version: original.version,
  };
  const save = vi.fn();
  const sync = new DraftSynchronizer({
    revision: 3,
    snapshot: projectSnapshot(original),
    latest: () => reordered,
    upload: async (p) => p,
    save,
    acknowledged: vi.fn(),
  });
  expect(sync.dirty).toBe(false);
  await sync.save();
  expect(save).not.toHaveBeenCalled();
});
