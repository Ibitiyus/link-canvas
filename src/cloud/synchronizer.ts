import type { Project } from "../model/types";
import type { Draft } from "./types";
import { RevisionConflict } from "./errors";
import { projectSnapshot } from "./snapshot";
interface Options {
  revision: number;
  snapshot: string;
  latest: () => Project;
  upload: (project: Project, signal: AbortSignal) => Promise<Project>;
  save: (project: Project, revision: number) => Promise<Draft>;
  acknowledged: (draft: Draft, localSnapshot: string) => void;
}
/** One writer per tab; server CAS catches concurrent writers on other devices. */
export class DraftSynchronizer {
  revision: number;
  snapshot: string;
  private running: Promise<void> | null = null;
  private controller = new AbortController();
  constructor(private options: Options) {
    this.revision = options.revision;
    this.snapshot = options.snapshot;
  }
  get dirty() {
    return projectSnapshot(this.options.latest()) !== this.snapshot;
  }
  stop() {
    this.controller.abort();
  }
  save(forceCreate = false): Promise<void> {
    if (this.running) return this.running;
    this.running = this.drain(forceCreate).finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain(forceCreate: boolean) {
    while (
      !this.controller.signal.aborted &&
      (this.dirty || (forceCreate && this.revision === 0))
    ) {
      const local = this.options.latest(),
        serialized = projectSnapshot(local);
      const project = await this.options.upload(local, this.controller.signal);
      if (this.controller.signal.aborted) throw new Error("SESSION_CHANGED");
      const draft = await this.options.save(project, this.revision);
      if (this.controller.signal.aborted) throw new Error("SESSION_CHANGED");
      if (draft.revision !== this.revision + 1) throw new RevisionConflict();
      this.revision = draft.revision;
      this.snapshot = serialized;
      this.options.acknowledged(draft, serialized);
    }
  }
}
