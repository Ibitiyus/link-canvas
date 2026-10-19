import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Grip, MoveUpRight } from "lucide-react";
import { clampBlock, gridRows } from "../model/grid";
import { safeUrl } from "../model/media";
import { FONTS, ROW_HEIGHT, type Block, type Project } from "../model/types";
import { BlockContent } from "./BlockContent";

interface Props {
  project: Project;
  rowHeight?: number;
  editing?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onUpdate?: (id: string, patch: Partial<Block>) => void;
}
interface Gesture {
  id: string;
  mode: "move" | "resize";
  block: Block;
}
export function Canvas({
  project,
  editing = false,
  rowHeight = ROW_HEIGHT,
  selectedId,
  onSelect,
  onUpdate,
}: Props) {
  const board = useRef<HTMLDivElement>(null);
  const [gesture, setGesture] = useState<Gesture | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const suppressClick = useRef(false);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    cleanup.current?.();
    setGesture(null);
  }, [project]);
  const { page, blocks } = project;
  const rows = gridRows(blocks);
  const decoBottom = Math.max(
    0,
    ...blocks
      .filter((b) => b.type === "decoration")
      .map((b) => b.y + b.height + 32),
  );
  const height = Math.max(rows * rowHeight + (rows - 1) * page.gap, decoBottom);
  const start = (
    event: ReactPointerEvent,
    block: Block,
    mode: "move" | "resize",
  ) => {
    if (!editing || event.button !== 0 || !board.current) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(block.id);
    cleanup.current?.();
    const startX = event.clientX,
      startY = event.clientY;
    const rect = board.current.getBoundingClientRect();
    const unitX = (rect.width + page.gap) / page.columns,
      unitY = rowHeight + page.gap;
    let candidate = block;
    setGesture({ id: block.id, mode, block });
    const move = (next: PointerEvent) => {
      const dx = next.clientX - startX,
        dy = next.clientY - startY;
      if (block.type === "decoration") {
        const logicalDx = (dx * page.maxWidth) / rect.width;
        candidate =
          mode === "move"
            ? {
                ...block,
                x: Math.max(
                  0,
                  Math.min(page.maxWidth - block.width, block.x + logicalDx),
                ),
                y: Math.max(0, Math.min(30000, block.y + dy)),
              }
            : {
                ...block,
                width: Math.max(
                  24,
                  Math.min(page.maxWidth - block.x, block.width + logicalDx),
                ),
                height: Math.max(24, Math.min(2000, block.height + dy)),
              };
      } else
        candidate = clampBlock(
          mode === "move"
            ? {
                ...block,
                col: block.col + Math.round(dx / unitX),
                row: Math.min(2000, block.row + Math.round(dy / unitY)),
              }
            : {
                ...block,
                colSpan: Math.min(
                  page.columns - block.col,
                  block.colSpan + Math.round(dx / unitX),
                ),
                rowSpan: block.rowSpan + Math.round(dy / unitY),
              },
          page.columns,
        );
      setGesture({ id: block.id, mode, block: candidate });
    };
    const finish = () => {
      cleanup.current?.();
      setGesture(null);
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      onUpdate?.(block.id, candidate);
      onSelect?.(block.id);
    };
    const cancel = () => {
      cleanup.current?.();
      setGesture(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    const previousSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      document.body.style.userSelect = previousSelect;
      cleanup.current = null;
    };
  };
  const placement = (block: Block) => ({
    gridColumn: `${block.col + 1} / span ${block.colSpan}`,
    gridRow: `${block.row + 1} / span ${block.rowSpan}`,
  });
  const gridBlocks = blocks.filter((b) => b.type !== "decoration");
  const decorBlocks = blocks
    .filter((b) => b.type === "decoration")
    .sort((a, b) => a.zIndex - b.zIndex);
  const backgroundImage = safeUrl(page.backgroundImage);
  return (
    <div
      className={`page-surface ${editing ? "editor-surface" : ""}`}
      style={{
        maxWidth: page.maxWidth,
        backgroundColor: page.background,
        backgroundImage: backgroundImage
          ? `url(${JSON.stringify(backgroundImage)})`
          : undefined,
        fontFamily: FONTS[page.font],
      }}
    >
      <div
        ref={board}
        className={`canvas ${gesture ? "is-dragging" : ""}`}
        data-testid="canvas"
        style={{
          gridTemplateColumns: `repeat(${page.columns}, minmax(0, 1fr))`,
          gridAutoRows: rowHeight,
          gap: page.gap,
          minHeight: height,
        }}
        onClickCapture={(event) => {
          if (suppressClick.current) {
            event.stopPropagation();
            event.preventDefault();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelect?.(null);
        }}
      >
        {editing &&
          Array.from({ length: rows * page.columns }, (_, index) => {
            const col = index % page.columns,
              row = Math.floor(index / page.columns);
            const occupied = gridBlocks.some(
              (b) =>
                col >= b.col &&
                col < b.col + b.colSpan &&
                row >= b.row &&
                row < b.row + b.rowSpan,
            );
            return (
              <div
                key={`cell-${index}`}
                className={`grid-cell ${occupied ? "occupied" : ""}`}
                style={{ gridColumn: col + 1, gridRow: row + 1 }}
                aria-hidden="true"
              >
                {!occupied && <span>+</span>}
              </div>
            );
          })}
        {gridBlocks.map((block) => (
          <div
            key={block.id}
            data-testid={`block-${block.id}`}
            data-block-id={block.id}
            className={`canvas-block ${editing ? "editable" : ""} ${selectedId === block.id && editing ? "selected" : ""} ${gesture?.id === block.id ? "drag-source" : ""}`}
            style={placement(block)}
            onClick={(event) => {
              if (editing) {
                event.stopPropagation();
                onSelect?.(block.id);
              }
            }}
            onKeyDown={(event) => {
              if (editing && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelect?.(block.id);
              }
            }}
            tabIndex={editing ? 0 : undefined}
            aria-label={editing ? `Блок: ${block.name}` : undefined}
          >
            <BlockContent block={block} editing={editing} />
            {editing && (
              <>
                <button
                  type="button"
                  className="drag-handle"
                  title={`Переместить: ${block.name}`}
                  aria-label={`Переместить: ${block.name}`}
                  onPointerDown={(event) => start(event, block, "move")}
                >
                  <Grip size={13} />
                  <span>{block.name}</span>
                </button>
                {selectedId === block.id && (
                  <>
                    <span className="size-badge">
                      {block.colSpan} × {block.rowSpan}
                    </span>
                    <button
                      type="button"
                      className="resize-handle"
                      aria-label={`Изменить размер: ${block.name}`}
                      title="Тяните для изменения ширины и высоты"
                      onPointerDown={(event) => start(event, block, "resize")}
                    >
                      <MoveUpRight size={15} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
        {editing && gesture && gesture.block.type !== "decoration" && (
          <div
            className="drop-ghost"
            style={placement(gesture.block)}
            aria-live="polite"
          >
            <span>
              {gesture.block.col + 1}:{gesture.block.row + 1} ·{" "}
              {gesture.block.colSpan} × {gesture.block.rowSpan}
            </span>
          </div>
        )}
        {decorBlocks.map((original) => {
          const block = gesture?.id === original.id ? gesture.block : original;
          return (
            <div
              key={block.id}
              data-block-id={block.id}
              className={`free-block ${editing ? "editable" : ""} ${selectedId === block.id && editing ? "selected" : ""}`}
              style={{
                left: `${(block.x / page.maxWidth) * 100}%`,
                top: block.y,
                width: `${(block.width / page.maxWidth) * 100}%`,
                height: block.height,
                transform: `rotate(${block.rotation}deg)`,
                zIndex: block.zIndex + 10,
              }}
              tabIndex={editing ? 0 : undefined}
              aria-label={editing ? `Блок: ${block.name}` : undefined}
              onClick={(event) => {
                if (editing) {
                  event.stopPropagation();
                  onSelect?.(block.id);
                }
              }}
              onPointerDown={(event) => start(event, original, "move")}
            >
              <BlockContent block={block} editing={editing} />
              {editing && selectedId === block.id && (
                <button
                  type="button"
                  className="resize-handle"
                  title="Изменить размер"
                  aria-label={`Изменить размер: ${block.name}`}
                  onPointerDown={(event) => start(event, original, "resize")}
                >
                  <MoveUpRight size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
