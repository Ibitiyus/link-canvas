import {
  MobileEditorTools,
  type MobileTool,
  type SheetSize,
} from "../components/MobileEditorTools";
import type { CSSProperties } from "react";
import { CloudBar } from "../components/CloudBar";
import { useEffect, useState } from "react";
import { CircleHelp, Grid2X2, X } from "lucide-react";
import { useProject } from "../state/ProjectContext";
import { Toolbar } from "../components/Toolbar";
import { Library } from "../components/Library";
import { Inspector } from "../components/Inspector";
import { Canvas } from "../components/Canvas";
export function Editor() {
  const [tool, setTool] = useState<MobileTool>(null),
    [sheetSize, setSheetSize] = useState<SheetSize>("medium");
  const [visual, setVisual] = useState({
    height: window.innerHeight,
    inset: 0,
  });
  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      setVisual({
        height: vv?.height ?? window.innerHeight,
        inset: Math.max(
          0,
          window.innerHeight -
            (vv?.height ?? window.innerHeight) -
            (vv?.offsetTop ?? 0),
        ),
      });
    };
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    update();
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);
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
        if (!project.blocks.find((b) => b.id === selectedId)?.locked)
          remove(selectedId);
      } else if (event.key === "Escape") select(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selectedId, undo, redo, remove, duplicate, select, project]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedId || !matchMedia("(max-width:1050px)").matches) return;
      const canvas = document.querySelector(".workspace .canvas");
      if (
        ["dragging", "resizing"].includes(
          canvas?.getAttribute("data-interaction-mode") ?? "",
        )
      )
        return;
      const block = document.querySelector<HTMLElement>(
          `[data-block-id="${CSS.escape(selectedId)}"]`,
        ),
        scroll = document.querySelector<HTMLElement>(".canvas-scroll");
      if (!block || !scroll) return;
      const r = block.getBoundingClientRect(),
        area = scroll.getBoundingClientRect(),
        sheet = document
          .querySelector(".mobile-sheet")
          ?.getBoundingClientRect();
      const bottom = Math.min(area.bottom, sheet?.top ?? area.bottom) - 24;
      const target = area.top + Math.max(24, (bottom - area.top) / 2);
      scroll.scrollTop += r.top + r.height / 2 - target;
    }, 450);
    return () => clearTimeout(timer);
  }, [selectedId, tool, sheetSize, visual.height]);
  return (
    <div
      className="editor-shell"
      data-mobile-tool={tool ?? "none"}
      style={
        {
          "--editor-vh": `${visual.height}px`,
          "--keyboard-inset": `${visual.inset}px`,
        } as CSSProperties
      }
    >
      <Toolbar />
      <CloudBar />
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
        <Library
          requestedTab={
            tool === "layers"
              ? "layers"
              : tool === "library"
                ? "blocks"
                : undefined
          }
          onAdd={() => {
            setTool("block");
            setSheetSize("medium");
          }}
        />
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
        <Inspector
          requestedTab={
            tool === "page" ? "page" : tool === "block" ? "block" : undefined
          }
        />
      </div>
      <MobileEditorTools
        tool={tool}
        size={sheetSize}
        onTool={setTool}
        onSize={setSheetSize}
      />
    </div>
  );
}
