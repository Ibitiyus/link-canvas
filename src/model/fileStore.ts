import { createId } from "./id";
export const isAssetRef = (value: string) =>
  /^asset:[A-Za-z0-9_-]{1,100}$/.test(value);
export interface StoredFile {
  id: string;
  name: string;
  blob: Blob;
}
let database: Promise<IDBDatabase> | undefined;
function openDatabase(): Promise<IDBDatabase> {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("Хранилище файлов недоступно в этом браузере."));
        return;
      }
      const request = indexedDB.open("link-canvas.files.v1", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("files", { keyPath: "id" });
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          database = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error("Закройте другие вкладки ZIN и повторите загрузку."));
    }).catch((error) => {
      database = undefined;
      throw error;
    });
  return database;
}
export function fileStorageError(error: unknown): Error {
  return new Error(
    error instanceof DOMException && error.name === "QuotaExceededError"
      ? "Недостаточно места в хранилище браузера. Освободите место на устройстве и повторите загрузку."
      : error instanceof Error
        ? error.message
        : "Не удалось сохранить файл в браузере.",
  );
}
export async function storeFiles(files: StoredFile[]): Promise<void> {
  if (!files.length) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Сохранение файлов прервано."));
      transaction.onerror = () => {
        /* abort reports the transaction error */
      };
      try {
        for (const file of files) transaction.objectStore("files").put(file);
      } catch (error) {
        transaction.abort();
        reject(error);
      }
    });
  } catch (error) {
    throw fileStorageError(error);
  }
}
export async function storeFile(blob: Blob, name: string): Promise<string> {
  const id = createId();
  await storeFiles([{ id, blob, name }]);
  return `asset:${id}`;
}
export async function getFile(ref: string): Promise<StoredFile> {
  if (!isAssetRef(ref)) throw new Error("Некорректная ссылка на файл.");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("files", "readonly")
      .objectStore("files")
      .get(ref.slice(6));
    request.onsuccess = () =>
      request.result
        ? resolve(request.result as StoredFile)
        : reject(
            new Error(
              "Файл не найден в этом браузере. Загрузите его заново или импортируйте резервную копию.",
            ),
          );
    request.onerror = () => reject(request.error);
  });
}
