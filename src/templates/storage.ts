import type { Project } from "../model/types";
import { parseProject } from "../model/storage";
import { exportProject, importProject } from "../model/backup";
import { createId } from "../model/id";
export interface SavedTemplate {
  id: string;
  name: string;
  created: number;
  project: Project;
}
const DB = "zin.templates.v1";
let dbPromise: Promise<IDBDatabase> | undefined;
function open() {
  return (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("templates", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => {
      dbPromise = undefined;
      reject(
        new Error(
          "Библиотека шаблонов недоступна. Проверьте хранилище браузера.",
        ),
      );
    };
  }));
}
async function operation<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("templates", mode),
      req = run(tx.objectStore("templates"));
    let value: T;
    req.onsuccess = () => {
      value = req.result;
    };
    tx.oncomplete = () => resolve(value);
    tx.onabort = () =>
      reject(
        new Error(
          "Не удалось сохранить шаблон: хранилище недоступно или переполнено. Экспортируйте JSON.",
        ),
      );
    tx.onerror = () => {};
  });
}
export function templateName(name: string) {
  const n = name.trim();
  if (!n || n.length > 80)
    throw new Error("Введите название от 1 до 80 символов.");
  return n;
}
export async function listSaved() {
  const rows = (await operation("readonly", (s) =>
    s.getAll(),
  )) as SavedTemplate[];
  return rows.sort((a, b) => b.created - a.created);
}
export async function getSaved(id: string) {
  const row = (await operation("readonly", (s) => s.get(id))) as
    SavedTemplate | undefined;
  if (!row) throw new Error("Шаблон не найден в этом браузере.");
  return { ...row, project: parseProject(JSON.stringify(row.project)) };
}
export async function saveTemplate(
  project: Project,
  name: string,
  recovery = false,
) {
  const cleanName = templateName(name);
  if (
    !recovery &&
    (await listSaved()).filter((r) => r.id !== "recovery").length >= 24
  )
    throw new Error(
      "В локальной библиотеке максимум 24 шаблона. Удалите ненужный и повторите.",
    );
  // Copy private cloud/local assets now; snapshots never depend on the active account.
  const copy = await importProject(await (await exportProject(project)).text());
  const row: SavedTemplate = {
    id: recovery ? "recovery" : `saved-${createId()}`,
    name: cleanName,
    created: Date.now(),
    project: (await import("./designs")).freshProject(copy),
  };
  await operation("readwrite", (s) => s.put(row));
  return row;
}
export async function renameTemplate(id: string, name: string) {
  const row = await getSaved(id);
  await operation("readwrite", (s) =>
    s.put({ ...row, name: templateName(name) }),
  );
}
export async function deleteTemplate(id: string) {
  await operation("readwrite", (s) => s.delete(id));
}
