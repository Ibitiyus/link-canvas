import { EffectSurface } from "./EffectSurface";
import { isFree } from "../model/placement";
import { selectionBox, transformSelection } from "../model/creative";
import { useEffect, useRef, useState, useMemo } from "react";
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
  showAnimations?: boolean;
  previewEffect?: { id: string; token: number } | null;
  project: Project;
  rowHeight?: number;
  editing?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null, additive?: boolean) => void;
  selectedIds?: string[];
  multiSelect?: boolean;
  onUnlockSelection?: () => void;
  onTransform?: (ids: string[], from: Block, to: Block) => void;
  onUpdate?: (id: string, patch: Partial<Block>) => void;
}
export function Canvas({
  project,
  showAnimations = false,
  previewEffect,
  editing = false,
  rowHeight = ROW_HEIGHT,
  selectedId,
  onSelect,
  selectedIds = [],
  multiSelect = false,
  onTransform,
  onUnlockSelection,
  onUpdate,
}: Props) {
  const board = useRef<HTMLDivElement>(null),
    [contentId, setContentId] = useState<string | null>(null);
  useEffect(() => setContentId(null), [selectedId]);
  const { page, blocks } = project,
    rows = gridRows(blocks),
    height = rows * rowHeight + (rows - 1) * page.gap;
  const gestureIds = useRef<string[]>([]),
    groupOrigin = useRef<Block | null>(null);
  const multiBox =
    selectedIds.length > 1 ? selectionBox(project, selectedIds) : null;
  const { gesture, mode, begin, suppressClick } = useCanvasGesture({
    board,
    width: page.maxWidth,
    columns: page.columns,
    gap: page.gap,
    rowHeight,
    onSelect: (id) => {
      if (id !== "__selection__" && id !== selectedId) onSelect?.(id);
    },
    onUpdate: (id, patch) => {
      if (id === "__selection__" && groupOrigin.current)
        onTransform?.(gestureIds.current, groupOrigin.current, patch as Block);
      else onUpdate?.(id, patch);
    },
    enabled: editing,
    reset: project,
  });
  const selected = multiBox ?? blocks.find((b) => b.id === selectedId),
    order = orderedLayers(blocks),
    stack = new Map(order.map((b, i) => [b.id, i + 1]));
  const visualBlocks =
    gesture?.block.id === "__selection__" && groupOrigin.current
      ? transformSelection(
          project,
          gestureIds.current,
          groupOrigin.current,
          gesture.block,
        ).blocks
      : blocks;
  const gridBlocks = visualBlocks.filter((b) => !isFree(b)),
    decorBlocks = orderedLayers(visualBlocks).filter(isFree);
  const occupiedCells = useMemo(() => {
    const cells = new Set<number>();
    if (!editing) return cells;
    for (const b of blocks.filter((b) => !isFree(b)))
      for (let row = b.row; row < b.row + b.rowSpan; row++)
        for (let col = b.col; col < b.col + b.colSpan; col++)
          cells.add(row * page.columns + col);
    return cells;
  }, [blocks, page.columns, editing]);
  const start = (
    event: React.PointerEvent,
    block: Block,
    edge?: import("../model/gestures").ResizeEdge | "rotate",
    immediate = false,
  ) => {
    if (!editing) return;
    if (!edge && !immediate && (multiSelect || event.shiftKey)) {
      event.stopPropagation();
      onSelect?.(block.id, true);
      return;
    }
    let ids =
      block.id === "__selection__"
        ? selectedIds
        : selectedIds.includes(block.id) && selectedIds.length > 1
          ? selectedIds
          : block.groupId &&
              !(selectedIds.length === 1 && selectedIds[0] === block.id)
            ? blocks.filter((b) => b.groupId === block.groupId).map((b) => b.id)
            : [block.id];
    if (ids.length > 1) {
      const box = selectionBox(project, ids);
      if (!box) return;
      gestureIds.current = ids;
      groupOrigin.current = box;
      if (block.id !== "__selection__" && !selectedIds.includes(block.id))
        onSelect?.(block.id);
      begin(event, box, edge, immediate);
    } else begin(event, block, edge, immediate);
  };
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
                : mode === "rotating"
                  ? "Поворот"
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
        decorations={order
          .filter(isFree)
          .filter(
            (b) =>
              !b.hidden ||
              (editing && (selectedIds.includes(b.id) || b.id === selectedId)),
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
                  occupied = occupiedCells.has(index);
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
                className={`canvas-block ${editing ? "editable" : ""} ${(selectedIds.includes(block.id) || selectedId === block.id) && editing ? "selected" : ""} ${block.locked ? "is-locked" : ""} ${gesture?.block.id === block.id ? "drag-source" : ""}`}
                style={{
                  ...placement(block),
                  zIndex: stack.get(block.id),
                  visibility: block.hidden ? "hidden" : undefined,
                }}
                onPointerDownCapture={(event) => {
                  if (contentId !== block.id) start(event, block);
                  else onSelect?.(block.id);
                }}
                onClick={(event) => {
                  if (editing) {
                    event.stopPropagation();
                    if (
                      !multiSelect &&
                      !event.shiftKey &&
                      (block.id !== selectedId || selectedIds.length > 1)
                    )
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
                    if (
                      !multiSelect &&
                      !event.shiftKey &&
                      (block.id !== selectedId || selectedIds.length > 1)
                    )
                      onSelect?.(block.id);
                  }
                }}
                tabIndex={editing ? 0 : undefined}
                aria-label={editing ? `Блок: ${block.name}` : undefined}
              >
                <EffectSurface
                  effects={block.effects}
                  active={!editing || showAnimations}
                  suspended={!!gesture}
                  previewToken={
                    previewEffect?.id === block.id ? previewEffect.token : 0
                  }
                >
                  <BlockContent
                    block={block}
                    editing={editing && contentId !== block.id}
                  />
                </EffectSurface>
                {editing && !block.locked && (
                  <button
                    type="button"
                    className="drag-handle"
                    aria-label={`Переместить: ${block.name}`}
                    title={`Переместить: ${block.name}`}
                    onPointerDown={(event) =>
                      start(event, block, undefined, true)
                    }
                  >
                    <Grip size={13} />
                    <span>{block.name}</span>
                  </button>
                )}
              </div>
            ))}
            {editing && gesture && !isFree(gesture.block) && (
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
            {(() => {
              const renderFree = (
                original: Block,
                offsetX = 0,
                offsetY = 0,
              ) => {
                const block =
                  gesture?.block.id === original.id ? gesture.block : original;
                return (
                  <div
                    key={block.id}
                    data-block-id={block.id}
                    className={`free-block ${editing ? "editable" : ""} ${(selectedIds.includes(block.id) || selectedId === block.id) && editing ? "selected" : ""} ${block.locked ? "is-locked" : ""}`}
                    style={{
                      ...freePlacement({
                        ...block,
                        x: block.x - offsetX,
                        y: block.y - offsetY,
                      }),
                      zIndex: stack.get(block.id),
                      visibility: block.hidden ? "hidden" : undefined,
                    }}
                    tabIndex={editing ? 0 : undefined}
                    aria-label={editing ? `Блок: ${block.name}` : undefined}
                    onClick={(event) => {
                      if (editing) {
                        event.stopPropagation();
                        if (
                          !multiSelect &&
                          !event.shiftKey &&
                          (block.id !== selectedId || selectedIds.length > 1)
                        )
                          onSelect?.(block.id);
                      }
                    }}
                    onPointerDownCapture={(event) => {
                      if (contentId !== original.id) start(event, original);
                    }}
                  >
                    <EffectSurface
                      effects={block.effects}
                      active={!editing || showAnimations}
                      suspended={!!gesture}
                      previewToken={
                        previewEffect?.id === block.id ? previewEffect.token : 0
                      }
                    >
                      <BlockContent
                        block={block}
                        editing={editing && contentId !== block.id}
                      />
                    </EffectSurface>
                  </div>
                );
              };
              const rendered = new Set<string>();
              return decorBlocks.map((block) => {
                const group = project.groups?.find(
                  (g) => g.id === block.groupId,
                );
                if (!group) return renderFree(block);
                if (rendered.has(group.id)) return null;
                rendered.add(group.id);
                const members = decorBlocks.filter(
                    (b) => b.groupId === group.id,
                  ),
                  bounds = selectionBox(
                    { ...project, blocks: visualBlocks },
                    members.map((b) => b.id),
                  )!;
                return (
                  <div
                    key={`group-${group.id}`}
                    className="effect-group"
                    data-effect-group={group.id}
                    style={{
                      left: bounds.x,
                      top: bounds.y,
                      width: bounds.width,
                      height: bounds.height,
                      zIndex: Math.max(
                        ...members.map((b) => stack.get(b.id) ?? 0),
                      ),
                    }}
                  >
                    <EffectSurface
                      effects={group.effects}
                      active={!editing || showAnimations}
                      suspended={!!gesture}
                      previewToken={
                        previewEffect?.id === group.id ? previewEffect.token : 0
                      }
                    >
                      <div
                        style={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        {members.map((b) => renderFree(b, bounds.x, bounds.y))}
                      </div>
                    </EffectSurface>
                  </div>
                );
              });
            })()}
            {editing && selected && display && (
              <div
                className={`selection-overlay ${selected.locked ? "selection-locked" : ""}`}
                data-selection-id={selected.id}
                style={{
                  ...(isFree(selected)
                    ? freePlacement(display)
                    : placement(display)),
                  zIndex: blocks.length + 2,
                }}
              >
                {selected.locked ? (
                  <button
                    type="button"
                    className="selection-unlock"
                    onClick={() => {
                      if (selected.id === "__selection__")
                        onUnlockSelection?.();
                      else onUpdate?.(selected.id, { locked: false });
                    }}
                  >
                    Разблокировать
                  </button>
                ) : (
                  !content && (
                    <SelectionHandles
                      block={display}
                      onResize={(event, edge) =>
                        start(event, selected, edge, true)
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
