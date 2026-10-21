import { useRef, useState, useEffect } from "react";
import { useProject } from "../state/ProjectContext";
import { saveTemplate } from "../templates/storage";
export default function SaveTemplateDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const { project, notify } = useProject(),
    [name, setName] = useState(project.page.title),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="template-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await saveTemplate(project, name);
            notify("Шаблон сохранён в этом браузере. Это не публикация.");
            onClose();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Не удалось сохранить шаблон.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>Сохранить как шаблон</h2>
        <p>
          Локальная копия композиции и её файлов. Доступна на этом устройстве,
          независимо от публикации.
        </p>
        <label>
          Название шаблона
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="template-dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Отмена
          </button>
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? "Сохраняем…" : "Сохранить шаблон"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
