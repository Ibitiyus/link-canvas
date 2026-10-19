import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Grip, MoveUpRight } from "lucide-react";
import { clampDecoration, decorationBounds } from "../model/decoration";
import { clampBlock, gridRows } from "../model/grid";
import { useAssetSource } from "../hooks/useAssetSource";
import { safeImageSource } from "../model/assets";
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
  const frame = useRef<HTMLDivElement>(null),
    surface = useRef<HTMLDivElement>(null);
  const [measure, setMeasure] = useState({ width: 0, padding: 20 });
  useEffect(() => {
    if (!frame.current) return;
    const update = () => {
      const width = frame.current?.clientWidth ?? 0;
      const padding = surface.current
        ? parseFloat(getComputedStyle(surface.current).paddingLeft)
        : 20;
      setMeasure((previous) =>
        previous.width === width && previous.padding === padding
          ? previous
          : { width, padding },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(frame.current);
    update();
    return () => observer.disconnect();
  }, []);
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
  const height = rows * rowHeight + (rows - 1) * page.gap;
  const displayWidth = Math.min(measure.width || page.maxWidth, page.maxWidth);
  const gridWidth = Math.max(1, displayWidth - measure.padding * 2);
  const bounds = blocks
    .filter((b) => b.type === "decoration")
    .map((b) => decorationBounds(b, gridWidth / page.maxWidth));
  // Reserve scrollable space around the page. Freeze these extents during a gesture
  // so dragging a decoration left/up does not shift the origin beneath the pointer.
  const extra = {
    left: Math.max(
      0,
      -Math.min(0, ...bounds.map((b) => b.left)) - measure.padding + 12,
    ),
    right: Math.max(
      0,
      Math.max(gridWidth, ...bounds.map((b) => b.right)) -
        gridWidth -
        measure.padding +
        12,
    ),
    top: Math.max(
      0,
      -Math.min(0, ...bounds.map((b) => b.top)) - measure.padding + 12,
    ),
    bottom: Math.max(
      0,
      Math.max(height, ...bounds.map((b) => b.bottom)) -
        height -
        measure.padding +
        12,
    ),
  };
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
        candidate = clampDecoration(
          mode === "move"
            ? { ...block, x: block.x + logicalDx, y: block.y + dy }
            : {
                ...block,
                width: block.width + logicalDx,
                height: block.height + dy,
              },
        );
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
  const { src: backgroundImage } = useAssetSource(
    safeImageSource(page.backgroundImage),
  );
  return (
    <div className="canvas-frame" ref={frame}>
      <div
        className="canvas-extent"
        style={{
          width: measure.width
            ? displayWidth + extra.left + extra.right
            : "100%",
          paddingLeft: extra.left,
          paddingRight: extra.right,
          paddingTop: extra.top,
          paddingBottom: extra.bottom,
        }}
      >
        <div
          ref={surface}
          className={`page-surface ${editing ? "editor-surface" : ""}`}
          style={{
            maxWidth: page.maxWidth,
            width: measure.width ? displayWidth : "100%",
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
                onClickCapture={() => {
                  if (editing && block.type === "audio") onSelect?.(block.id);
                }}
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
                          onPointerDown={(event) =>
                            start(event, block, "resize")
                          }
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
              const block =
                gesture?.id === original.id ? gesture.block : original;
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
                      onPointerDown={(event) =>
                        start(event, original, "resize")
                      }
                    >
                      <MoveUpRight size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
