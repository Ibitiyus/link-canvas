import type { Project } from "../model/types";

/** JSONB and the v1 reader reorder object keys; that must not count as an edit. */
export function projectSnapshot(project: Project): string {
  return JSON.stringify(project, (_key, value: unknown) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, record[key]]),
      );
    }
    return value;
  });
}
