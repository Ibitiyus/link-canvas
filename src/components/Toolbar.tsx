import { useRef, type ChangeEvent } from "react";
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
import { emptyProject } from "../model/defaults";
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
  } = useProject();
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "link-canvas.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("JSON экспортирован. Храните файл как резервную копию проекта.");
  };
  const importJSON = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 10_000_000)
        throw new Error("Максимальный размер файла — 10 МБ.");
      const loaded = parseProject(await file.text());
      if (
        !window.confirm(
          "Заменить текущую страницу проектом из файла? Действие можно отменить.",
        )
      )
        return;
      change(loaded);
      select(null);
      notify("Проект импортирован.");
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Не удалось импортировать проект.",
      );
    }
  };
  return (
    <header className="editor-toolbar">
      <Link className="brand" to="/" aria-label="Link Canvas — главная">
        <span className="brand-mark">
          <ArrowUpRight size={22} />
        </span>
        <span>
          link<span className="brand-light">canvas</span>
        </span>
      </Link>
      <span className="toolbar-divider" />
      <span className="project-name">
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
        onClick={() => {
          if (saveNow()) navigate("/preview");
        }}
      >
        <Eye size={16} />
        <span>Предпросмотр</span>
      </button>
    </header>
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
