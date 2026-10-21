import { RecoveryDialog } from "./RecoveryDialog";
import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Check,
  ChevronLeft,
  Eye,
  LoaderCircle,
  Redo2,
  RotateCcw,
  Undo2,
  TriangleAlert,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { Brand } from "./ui/Brand";
import { emptyProject } from "../model/defaults";
import { exportProject, importProject, downloadBackup } from "../model/backup";
import { parseProject } from "../model/storage";
export function Toolbar() {
  const {
    project,
    change,
    select,
    canUndo,
    canRedo,
    undo,
    redo,
    status,
    saveNow,
    notify,
    localConflict,
    resolveLocal,
  } = useProject();
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const exportJSON = async () => {
    setBusy(true);
    try {
      downloadBackup(await exportProject(project));
      notify(
        "JSON экспортирован вместе с файлами. Храните его как резервную копию.",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не удалось экспортировать проект.",
      );
    } finally {
      setBusy(false);
    }
  };
  const importJSON = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const raw = await file.text();
      parseProject(raw);
      if (
        !window.confirm(
          "Заменить текущую страницу проектом из файла? Действие можно отменить.",
        )
      )
        return;
      const loaded = await importProject(raw);
      change(loaded);
      select(null);
      notify("Проект импортирован.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не удалось импортировать проект.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {localConflict && (
        <div className="local-conflict" role="alert">
          <span>
            Конфликт локальных версий: автоматическая перезапись остановлена.
          </span>
          <button onClick={exportJSON}>Экспорт текущей версии</button>
          <button onClick={() => resolveLocal("stored")}>
            Открыть сохранённую версию
          </button>
          <button onClick={() => resolveLocal("current")}>
            Оставить текущую версию
          </button>
        </div>
      )}
      {recovery && <RecoveryDialog onClose={() => setRecovery(false)} />}
      <header className="editor-toolbar">
        <Brand />
        <span className="toolbar-edition" aria-hidden="true">
          РЕДАКТОР / 01
        </span>
        <span className="toolbar-divider" />
        <span className="project-name" title={project.page.title}>
          {project.page.title || "Без названия"}
        </span>
        <button
          className={`save-status ${status}`}
          onClick={saveNow}
          title="Сохранить сейчас"
        >
          {status === "saving" ? (
            <LoaderCircle size={13} className="spin" />
          ) : status === "error" ? (
            <TriangleAlert size={13} />
          ) : (
            <Check size={13} />
          )}
          <span>
            {status === "saving"
              ? "Сохранение…"
              : status === "error"
                ? "Ошибка сохранения"
                : "Сохранено"}
          </span>
        </button>
        <button
          className="icon-button"
          aria-label="Восстановление проекта"
          title="Восстановление проекта"
          onClick={() => setRecovery(true)}
        >
          <RotateCcw size={16} />
        </button>
        <div className="toolbar-spacer" />
        <div className="history-actions">
          <button
            className="icon-button"
            aria-label="Отменить"
            title="Отменить (Ctrl/⌘ Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Повторить"
            title="Повторить (Ctrl/⌘ Shift Z)"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 size={18} />
          </button>
        </div>
        <span className="toolbar-divider" />
        <button
          className="icon-button"
          title="Импорт JSON"
          aria-label="Импорт JSON"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <ArrowUpFromLine size={18} />
        </button>
        <input
          ref={input}
          hidden
          type="file"
          accept=".json,application/json"
          aria-label="Файл проекта JSON"
          onChange={importJSON}
        />
        <button
          className="icon-button"
          title="Экспорт JSON"
          aria-label="Экспорт JSON"
          disabled={busy}
          onClick={exportJSON}
        >
          <ArrowDownToLine size={18} />
        </button>
        <button
          className="icon-button reset-button"
          title="Сбросить страницу"
          aria-label="Сбросить страницу"
          onClick={() => {
            if (
              window.confirm(
                "Удалить все блоки и сбросить оформление страницы? Действие можно отменить.",
              )
            ) {
              change(emptyProject());
              select(null);
            }
          }}
        >
          <RotateCcw size={17} />
        </button>
        <button
          className="primary-button preview-button"
          aria-label="Предпросмотр"
          onClick={() => {
            if (saveNow()) navigate("/preview");
          }}
        >
          <Eye size={16} />
          <span>Предпросмотр</span>
          <ArrowUpRight size={16} />
        </button>
      </header>
    </>
  );
}
export function BackLink() {
  return (
    <Link className="text-link" to="/editor">
      <ChevronLeft size={16} />
      Вернуться в редактор
    </Link>
  );
}
