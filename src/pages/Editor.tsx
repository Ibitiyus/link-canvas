import { useEffect } from "react";
import { CircleHelp, Grid2X2, X } from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { Toolbar } from "../components/Toolbar";
import { Library } from "../components/Library";
import { Inspector } from "../components/Inspector";
import { Canvas } from "../components/Canvas";
export function Editor() {
  const {
    project,
    selectedId,
    select,
    updateBlock,
    undo,
    redo,
    remove,
    duplicate,
    message,
    notify,
  } = useProject();
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      )
        return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if (command && event.key.toLowerCase() === "d" && selectedId) {
        event.preventDefault();
        duplicate(selectedId);
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedId
      ) {
        event.preventDefault();
        remove(selectedId);
      } else if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selectedId, undo, redo, remove, duplicate, select]);
  return (
    <div className="editor-shell">
      <Toolbar />
      {message && (
        <div role="alert" className="notification">
          <CircleHelp size={16} />
          <span>{message}</span>
          <button
            title="Закрыть сообщение"
            aria-label="Закрыть сообщение"
            onClick={() => notify("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="editor-layout">
        <Library />
        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">ВАШЕ ПОЛОТНО</span>
              <h1>
                {project.page.title || "Без названия"}
                <span className="draft-badge">Черновик</span>
              </h1>
            </div>
            <span className="grid-label">
              <Grid2X2 size={14} />
              {project.page.columns} колонки
            </span>
          </div>
          <div className="canvas-scroll">
            <Canvas
              project={project}
              editing
              selectedId={selectedId}
              onSelect={select}
              onUpdate={updateBlock}
            />
          </div>
          <div className="workspace-footer">
            <span>
              <span className="tiny-dot" /> {project.blocks.length} блоков ·
              сохраняется локально
            </span>
            <span>Ctrl/⌘ Z — отменить · Esc — снять выбор</span>
          </div>
        </main>
        <Inspector />
      </div>
    </div>
  );
}
