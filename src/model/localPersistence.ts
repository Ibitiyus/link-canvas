import { createId } from "./id";
import type { Project } from "./types";

export class LocalConflict extends Error {
  constructor() {
    super(
      "Проект изменён в другой вкладке. Экспортируйте копию и выберите версию; автоматическая перезапись остановлена.",
    );
  }
}
/** A per-tab journal preserves both writers even if two processes race between get/set. */
export class LocalPersistence {
  constructor(
    private storage: Pick<Storage, "getItem" | "setItem">,
    readonly key: string,
    private baseline: string | null,
    readonly tabId: string = createId(),
    private protectedRaw = false,
  ) {}
  get recoveryKey() {
    return `${this.key}.recovery.${this.tabId}`;
  }
  current() {
    return this.storage.getItem(this.key);
  }
  adopt(raw: string | null) {
    this.baseline = raw;
    this.protectedRaw = false;
  }
  changed() {
    return this.current() !== this.baseline;
  }
  write(project: Project, force = false) {
    const raw = JSON.stringify(project),
      current = this.current();
    if (current === raw && !this.protectedRaw) {
      this.baseline = raw;
      return;
    }
    // Journal first. Quota errors must never erase the previous canonical version.
    this.storage.setItem(
      this.recoveryKey,
      JSON.stringify({ savedAt: new Date().toISOString(), raw }),
    );
    if ((this.protectedRaw || current !== this.baseline) && !force)
      throw new LocalConflict();
    if (force && current !== null)
      this.storage.setItem(`${this.recoveryKey}.previous`, current);
    this.storage.setItem(this.key, raw);
    this.baseline = raw;
    this.protectedRaw = false;
  }
}
