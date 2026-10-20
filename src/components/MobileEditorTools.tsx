import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type CSSProperties,
} from "react";
import {
  Layers,
  Plus,
  Settings2,
  SlidersHorizontal,
  ZoomIn,
  X,
} from "lucide-react";
export type MobileTool =
  "library" | "layers" | "block" | "page" | "zoom" | null;
export type SheetSize = "medium" | "full";
export function MobileEditorTools({
  tool,
  size,
  onTool,
  onSize,
}: {
  tool: MobileTool;
  size: SheetSize;
  onTool: (tool: MobileTool) => void;
  onSize: (size: SheetSize) => void;
}) {
  const [viewport, setViewport] = useState(
      () => window.visualViewport?.height ?? window.innerHeight,
    ),
    [dragHeight, setDragHeight] = useState<number | null>(null);
  const cleanup = useRef<(() => void) | null>(null),
    swiped = useRef(false);
  useEffect(() => {
    const update = () =>
      setViewport(window.visualViewport?.height ?? window.innerHeight);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      cleanup.current?.();
    };
  }, []);
  const [canvasTop, setCanvasTop] = useState(220);
  useEffect(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace"),
      heading = workspace?.querySelector<HTMLElement>(".workspace-heading"),
      bar = workspace?.querySelector<HTMLElement>(".canvas-interaction-bar");
    if (!workspace) return;
    const measure = () =>
      setCanvasTop(
        Math.round(
          workspace.getBoundingClientRect().top +
            (heading?.offsetHeight ?? 0) +
            (bar?.offsetHeight ?? 0) +
            44,
        ),
      );
    const observer = new ResizeObserver(measure);
    [workspace, heading, bar].forEach((node) => {
      if (node) observer.observe(node);
    });
    measure();
    return () => observer.disconnect();
  }, []);
  // Always reserve a visible strip of the composition, even with the large sheet.
  const fullHeight = Math.min(
    viewport * 0.74,
    Math.max(100, viewport - 60 - canvasTop - 72),
  );
  const mediumHeight = Math.min(viewport * 0.4, fullHeight * 0.75);
  const height = tool
    ? (dragHeight ?? (size === "full" ? fullHeight : mediumHeight))
    : 0;
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--mobile-sheet-height",
      `${height}px`,
    );
    return () => {
      document.documentElement.style.removeProperty("--mobile-sheet-height");
    };
  }, [height]);
  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (!tool) return;
    swiped.current = false;
    event.preventDefault();
    const y = event.clientY,
      initial = height,
      pointer = event.pointerId,
      node = event.currentTarget;
    let next = height;
    node.setPointerCapture(pointer);
    const move = (e: globalThis.PointerEvent) => {
      if (e.pointerId === pointer) {
        if (Math.abs(e.clientY - y) > 5) swiped.current = true;
        next = Math.max(0, Math.min(fullHeight, initial + y - e.clientY));
        setDragHeight(next);
      }
    };
    const stop = () => {
      cleanup.current?.();
      setDragHeight(null);
    };
    const up = (e: globalThis.PointerEvent) => {
      if (e.pointerId !== pointer) return;
      stop();
      if (next < mediumHeight * 0.5) onTool(null);
      else onSize(next > (mediumHeight + fullHeight) / 2 ? "full" : "medium");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", stop);
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      cleanup.current = null;
      try {
        node.releasePointerCapture(pointer);
      } catch {}
    };
  };
  const zoom = (action: "in" | "out" | "fit") => {
    const root = document.querySelector(".workspace .canvas-renderer");
    root?.dispatchEvent(new CustomEvent("zin:zoom", { detail: action }));
  };
  const tools = [
    ["library", "Добавить", Plus, "Открыть библиотеку"],
    ["layers", "Слои", Layers, "Открыть слои"],
    ["block", "Элемент", SlidersHorizontal, "Открыть настройки"],
    ["page", "Страница", Settings2, "Открыть настройки страницы"],
    ["zoom", "Масштаб", ZoomIn, "Открыть масштаб"],
  ] as const;
  return (
    <div
      className="mobile-editor-tools"
      style={{ "--sheet-height": `${height}px` } as CSSProperties}
    >
      {tool && (
        <section
          className="mobile-sheet"
          aria-label="Панель инструментов"
          data-sheet-size={size}
          style={{ height }}
        >
          <header className="sheet-header">
            <button
              className="sheet-grip"
              type="button"
              aria-label="Изменить высоту панели"
              onPointerDown={start}
              onClick={() => {
                if (!swiped.current)
                  onSize(size === "full" ? "medium" : "full");
              }}
            >
              <span />
            </button>
            <span>{tools.find((t) => t[0] === tool)?.[1]}</span>
            <button aria-label="Свернуть панель" onClick={() => onTool(null)}>
              <X size={18} />
            </button>
          </header>
          {tool === "zoom" && (
            <div className="sheet-zoom">
              <p>Масштаб просмотра не меняет сохранённую страницу.</p>
              <button onClick={() => zoom("out")}>Уменьшить</button>
              <button onClick={() => zoom("in")}>Увеличить</button>
              <button onClick={() => zoom("fit")}>По ширине</button>
            </div>
          )}
        </section>
      )}
      <nav className="mobile-tool-dock" aria-label="Панели редактора">
        {tools.map(([name, title, Icon, label]) => (
          <button
            key={name}
            aria-label={label}
            aria-expanded={tool === name}
            className={tool === name ? "active" : ""}
            onClick={() => {
              onTool(tool === name ? null : name);
              onSize("medium");
            }}
          >
            <Icon size={19} />
            <span>{title}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
