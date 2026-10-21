import { useEffect, useRef, useState } from "react";
import { useProject } from "../state/ProjectContext";
import { downloadBackup } from "../model/backup";
import { parseProject } from "../model/storage";
export function RecoveryDialog({ onClose }: { onClose: () => void }) {
  const { storageKey, change, notify } = useProject();
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [entries, setEntries] = useState(() => {
    try {
      const legacy = storageKey.startsWith("zin.account-project.")
        ? `zin.recovery.${storageKey.slice("zin.account-project.".length)}`
        : null;
      return [
        storageKey,
        ...(legacy ? [legacy] : []),
        ...Object.keys(localStorage).filter((key) =>
          key.startsWith(`${storageKey}.recovery.`),
        ),
      ]
        .map((key) => {
          const value = localStorage.getItem(key) ?? "";
          try {
            const journal = JSON.parse(value);
            return {
              key,
              raw: typeof journal.raw === "string" ? journal.raw : value,
              date: typeof journal.savedAt === "string" ? journal.savedAt : "",
            };
          } catch {
            return { key, raw: value, date: "" };
          }
        })
        .filter((entry) => entry.raw)
        .reverse();
    } catch {
      return [];
    }
  });
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const close = () => {
    ref.current?.close();
    onClose();
  };
  return (
    <dialog
      ref={ref}
      className="template-dialog"
      aria-labelledby="recovery-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <h2 id="recovery-title">Восстановление проекта</h2>
      <p>
        Копии содержат настройки и ссылки на файлы этого браузера. Для переноса
        вместе с файлами используйте «Экспорт JSON». Старые копии не удаляются
        автоматически.
      </p>
      {error && <p role="alert">{error}</p>}
      {!entries.length && (
        <p>Резервных копий пока нет или хранилище недоступно.</p>
      )}
      <div className="recovery-entries">
        {entries.map((entry, index) => {
          let title = "Повреждённые исходные данные",
            valid = false;
          try {
            title = parseProject(entry.raw).page.title || "Без названия";
            valid = true;
          } catch {
            /* allow downloading damaged originals */
          }
          return (
            <section key={entry.key}>
              <strong>{title}</strong>
              <small>
                {entry.date
                  ? new Date(entry.date).toLocaleString("ru-RU")
                  : entry.key === storageKey
                    ? "Текущее хранилище"
                    : "Предыдущая версия"}
              </small>
              <button
                onClick={() =>
                  downloadBackup(
                    new Blob([entry.raw], { type: "application/json" }),
                    `zin-recovery-${index + 1}.json`,
                  )
                }
              >
                Скачать исходный JSON
              </button>
              <button
                disabled={!valid}
                onClick={() => {
                  if (
                    !confirm(
                      "Открыть эту копию в редакторе? Текущее действие можно отменить. Для сохранения конфликтующих версий используйте экспорт JSON.",
                    )
                  )
                    return;
                  try {
                    change(parseProject(entry.raw));
                    notify(
                      "Резервная копия открыта. При конфликте выберите текущую версию для сохранения.",
                    );
                    close();
                  } catch {
                    setError(
                      "Не удалось открыть копию. Исходные данные доступны для скачивания.",
                    );
                  }
                }}
              >
                Открыть копию
              </button>
              {entry.key !== storageKey && (
                <button
                  onClick={() => {
                    if (
                      !confirm(
                        "Удалить только эту резервную копию? Текущий проект и медиафайлы останутся. При необходимости сначала скачайте исходный JSON.",
                      )
                    )
                      return;
                    try {
                      localStorage.removeItem(entry.key);
                      setEntries((current) =>
                        current.filter((item) => item.key !== entry.key),
                      );
                    } catch {
                      setError(
                        "Не удалось удалить копию. Хранилище недоступно.",
                      );
                    }
                  }}
                >
                  Удалить резервную копию
                </button>
              )}
            </section>
          );
        })}
      </div>
      <button onClick={close} autoFocus>
        Закрыть восстановление
      </button>
    </dialog>
  );
}
