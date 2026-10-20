import { useEffect, useRef, useState } from "react";
import { Grip } from "lucide-react";
import { gridRows } from "../model/grid";
import { orderedLayers } from "../model/layers";
import { useCanvasGesture } from "../hooks/useCanvasGesture";
import { useAssetSource } from "../hooks/useAssetSource";
import { safeImageSource } from "../model/assets";
import { FONTS, ROW_HEIGHT, type Block, type Project } from "../model/types";
import { BlockContent } from "./BlockContent";
import { CanvasViewport } from "./CanvasViewport";
import { SelectionHandles } from "./SelectionHandles";
import { CANVAS_PADDING } from "../model/canvasLayout";
interface Props {
  project: Project;
  rowHeight?: number;
  editing?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onUpdate?: (id: string, patch: Partial<Block>) => void;
}
export function Canvas({
  project,
  editing = false,
  rowHeight = ROW_HEIGHT,
  selectedId,
  onSelect,
  onUpdate,
}: Props) {
  const board = useRef<HTMLDivElement>(null),
    [contentId, setContentId] = useState<string | null>(null);
  useEffect(() => setContentId(null), [selectedId]);
  const { page, blocks } = project,
    rows = gridRows(blocks),
    height = rows * rowHeight + (rows - 1) * page.gap;
  const { gesture, mode, begin, suppressClick } = useCanvasGesture({
    board,
    width: page.maxWidth,
    columns: page.columns,
    gap: page.gap,
    rowHeight,
    onSelect,
    onUpdate,
    enabled: editing,
    reset: project,
  });
  const selected = blocks.find((b) => b.id === selectedId),
    order = orderedLayers(blocks),
    stack = new Map(order.map((b, i) => [b.id, i + 1]));
  const gridBlocks = blocks.filter((b) => b.type !== "decoration"),
    decorBlocks = order.filter((b) => b.type === "decoration");
  const placement = (b: Block) => ({
    gridColumn: `${b.col + 1} / span ${b.colSpan}`,
    gridRow: `${b.row + 1} / span ${b.rowSpan}`,
  });
  const freePlacement = (b: Block) => ({
    position: "absolute" as const,
    left: b.x,
    top: b.y,
    width: b.width,
    height: b.height,
    transform: `rotate(${b.rotation}deg)`,
  });
  const { src: backgroundImage } = useAssetSource(
    safeImageSource(page.backgroundImage),
  );
  const display =
    selected && (gesture?.block.id === selected.id ? gesture.block : selected);
  const content = !!selected && contentId === selected.id;
  return (
    <>
      {editing && (
        <div className="canvas-interaction-bar" role="status">
          <span>
            {content
              ? "Взаимодействие с содержимым"
              : mode === "dragging"
                ? "Перемещение"
                : mode === "resizing"
                  ? "Изменение размера"
                  : mode === "panning"
                    ? "Прокрутка"
                    : selected?.locked
                      ? "Положение закреплено"
                      : "Нажмите для выбора · удерживайте для перемещения"}
          </span>
          {selected &&
            ["audio", "video", "link", "qrcode"].includes(selected.type) && (
              <button
                type="button"
                onClick={() => setContentId(content ? null : selected.id)}
              >
                {content
                  ? "Вернуться к перемещению"
                  : "Взаимодействовать с медиа"}
              </button>
            )}
        </div>
      )}
      <CanvasViewport
        editing={editing}
        width={page.maxWidth}
        minHeight={height + CANVAS_PADDING * 2}
        decorations={decorBlocks.filter(
          (b) => !b.hidden || (editing && b.id === selectedId),
        )}
      >
        <div
          className={`page-surface ${editing ? "editor-surface" : ""}`}
          style={{
            maxWidth: page.maxWidth,
            width: page.maxWidth,
            padding: CANVAS_PADDING,
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
            data-interaction-mode={content ? "editing-content" : mode}
            onContextMenu={(event) => {
              if (editing && !content) event.preventDefault();
            }}
            style={{
              gridTemplateColumns: `repeat(${page.columns},minmax(0,1fr))`,
              gridAutoRows: rowHeight,
              gap: page.gap,
              minHeight: height,
            }}
            onClickCapture={(e) => {
              if (suppressClick.current) {
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onSelect?.(null);
            }}
          >
            {editing &&
              Array.from({ length: rows * page.columns }, (_, index) => {
                const col = index % page.columns,
                  row = Math.floor(index / page.columns),
                  occupied = gridBlocks.some(
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
                className={`canvas-block ${editing ? "editable" : ""} ${selectedId === block.id && editing ? "selected" : ""} ${block.locked ? "is-locked" : ""} ${gesture?.block.id === block.id ? "drag-source" : ""}`}
                style={{
                  ...placement(block),
                  zIndex: stack.get(block.id),
                  visibility: block.hidden ? "hidden" : undefined,
                }}
                onPointerDownCapture={(event) => {
                  if (contentId !== block.id) begin(event, block);
                  else onSelect?.(block.id);
                }}
                onClick={(event) => {
                  if (editing) {
                    event.stopPropagation();
                    onSelect?.(block.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (
                    editing &&
                    event.target === event.currentTarget &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    onSelect?.(block.id);
                  }
                }}
                tabIndex={editing ? 0 : undefined}
                aria-label={editing ? `Блок: ${block.name}` : undefined}
              >
                <BlockContent
                  block={block}
                  editing={editing && contentId !== block.id}
                />
                {editing && !block.locked && (
                  <button
                    type="button"
                    className="drag-handle"
                    aria-label={`Переместить: ${block.name}`}
                    title={`Переместить: ${block.name}`}
                    onPointerDown={(event) =>
                      begin(event, block, undefined, true)
                    }
                  >
                    <Grip size={13} />
                    <span>{block.name}</span>
                  </button>
                )}
              </div>
            ))}
            {editing && gesture && gesture.block.type !== "decoration" && (
              <div
                className="drop-ghost"
                style={{
                  ...placement(gesture.block),
                  zIndex: blocks.length + 1,
                }}
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
                gesture?.block.id === original.id ? gesture.block : original;
              return (
                <div
                  key={block.id}
                  data-block-id={block.id}
                  className={`free-block ${editing ? "editable" : ""} ${selectedId === block.id && editing ? "selected" : ""} ${block.locked ? "is-locked" : ""}`}
                  style={{
                    ...freePlacement(block),
                    zIndex: stack.get(block.id),
                    visibility: block.hidden ? "hidden" : undefined,
                  }}
                  tabIndex={editing ? 0 : undefined}
                  aria-label={editing ? `Блок: ${block.name}` : undefined}
                  onClick={(event) => {
                    if (editing) {
                      event.stopPropagation();
                      onSelect?.(block.id);
                    }
                  }}
                  onPointerDownCapture={(event) => begin(event, original)}
                >
                  <BlockContent block={block} editing={editing} />
                </div>
              );
            })}
            {editing && selected && display && (
              <div
                className={`selection-overlay ${selected.locked ? "selection-locked" : ""}`}
                data-selection-id={selected.id}
                style={{
                  ...(selected.type === "decoration"
                    ? freePlacement(display)
                    : placement(display)),
                  zIndex: blocks.length + 2,
                }}
              >
                {selected.locked ? (
                  <button
                    type="button"
                    className="selection-unlock"
                    onClick={() => onUpdate?.(selected.id, { locked: false })}
                  >
                    Разблокировать
                  </button>
                ) : (
                  !content && (
                    <SelectionHandles
                      block={display}
                      onResize={(event, edge) =>
                        begin(event, selected, edge, true)
                      }
                    />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </CanvasViewport>
    </>
  );
}
