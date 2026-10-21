import { expect, it } from "vitest";
import { emptyProject } from "./defaults";
import { LocalConflict, LocalPersistence } from "./localPersistence";
function setup() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
  return { data, storage };
}
it("preserves both tab versions and rejects a stale canonical write", () => {
  const { storage, data } = setup(),
    a = new LocalPersistence(storage, "p", null, "a"),
    b = new LocalPersistence(storage, "p", null, "b");
  const first = emptyProject(),
    second = { ...first, page: { ...first.page, title: "Вторая вкладка" } };
  a.write(first);
  expect(() => b.write(second)).toThrow(LocalConflict);
  expect(data.get("p")).toBe(JSON.stringify(first));
  expect(JSON.parse(data.get(b.recoveryKey)!).raw).toBe(JSON.stringify(second));
  b.write(second, true);
  expect(data.get(`${b.recoveryKey}.previous`)).toBe(JSON.stringify(first));
  expect(data.get("p")).toBe(JSON.stringify(second));
});
it("does not alter the canonical project if journal persistence fails", () => {
  const original = JSON.stringify(emptyProject());
  const storage = {
    getItem: () => original,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  const writer = new LocalPersistence(storage, "p", original, "a");
  expect(() =>
    writer.write(
      { ...emptyProject(), page: { ...emptyProject().page, title: "new" } },
      true,
    ),
  ).toThrow("QuotaExceededError");
  expect(storage.getItem()).toBe(original);
});
it("explicit replacement backs up damaged data byte for byte", () => {
  const { storage, data } = setup();
  storage.setItem("p", "{broken");
  const writer = new LocalPersistence(storage, "p", "{broken", "a");
  writer.write(emptyProject(), true);
  expect(data.get(`${writer.recoveryKey}.previous`)).toBe("{broken");
});
