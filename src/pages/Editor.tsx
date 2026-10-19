import { useEffect, useState } from "react";
import {
  CircleHelp,
  Grid2X2,
  Layers,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { Toolbar } from "../components/Toolbar";
import { Library } from "../components/Library";
import { Inspector } from "../components/Inspector";
import { Canvas } from "../components/Canvas";
const blockForms = new Intl.PluralRules("ru");
export function Editor() {
  const [mobilePanel, setMobilePanel] = useState<
    "library" | "canvas" | "inspector"
  >("canvas");
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
  const blockForm = blockForms.select(project.blocks.length);
  const blockWord =
    blockForm === "one" ? "блок" : blockForm === "few" ? "блока" : "блоков";
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
    <div className="editor-shell" data-mobile-panel={mobilePanel}>
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
      <nav className="mobile-toolbar" aria-label="Панели редактора">
        <button
          aria-label="Открыть библиотеку"
          aria-controls="library-panel"
          aria-expanded={mobilePanel === "library"}
          className={mobilePanel === "library" ? "active" : ""}
          onClick={() => setMobilePanel("library")}
        >
          <Layers size={16} />
          Блоки и слои
        </button>
        <button
          aria-label="Открыть полотно"
          aria-controls="workspace-panel"
          aria-expanded={mobilePanel === "canvas"}
          className={mobilePanel === "canvas" ? "active" : ""}
          onClick={() => setMobilePanel("canvas")}
        >
          <Grid2X2 size={16} />
          Полотно
        </button>
        <button
          aria-label="Открыть настройки"
          aria-controls="inspector-panel"
          aria-expanded={mobilePanel === "inspector"}
          className={mobilePanel === "inspector" ? "active" : ""}
          onClick={() => setMobilePanel("inspector")}
        >
          <SlidersHorizontal size={16} />
          Настройки
        </button>
      </nav>
      <div className="editor-layout">
        <Library onAdd={() => setMobilePanel("inspector")} />
        <main className="workspace" id="workspace-panel">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">02 / ВАШЕ МЕСТО В ИНТЕРНЕТЕ</span>
              <h1>
                {project.page.title || "Без названия"}
                <span className="draft-badge">ЛОКАЛЬНЫЙ ЧЕРНОВИК</span>
              </h1>
            </div>
            <span className="grid-label">
              <Grid2X2 size={14} />
              {project.page.columns}{" "}
              {project.page.columns === 5 ? "колонок" : "колонки"}
            </span>
          </div>
          <div className="canvas-scroll">
            <div
              className="canvas-ruler"
              style={{
                maxWidth: project.page.maxWidth,
                gridTemplateColumns: `repeat(${project.page.columns}, minmax(0, 1fr))`,
              }}
              aria-hidden="true"
            >
              {Array.from({ length: project.page.columns }, (_, i) => (
                <span key={i}>
                  {String(i + 1).padStart(2, "0")}
                  <i>+</i>
                </span>
              ))}
            </div>
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
              <span className="tiny-dot" /> ВСЁ ГОТОВО / {project.blocks.length}{" "}
              блоков
            </span>
            <span>Ctrl/⌘ Z — отменить · Esc — снять выбор</span>
          </div>
        </main>
        <Inspector />
      </div>
    </div>
  );
}
