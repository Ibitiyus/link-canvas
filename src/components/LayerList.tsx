import { Fragment, createElement } from "react";
import { BLOCK_ICONS } from "./blockIcons";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  MoreHorizontal,
  Trash2,
  Unlock,
} from "lucide-react";
import { LABELS } from "../model/types";
import { orderedLayers } from "../model/layers";
import { useProject } from "../state/ProjectContext";
export function LayerList() {
  const {
    project,
    selectedId,
    selectedIds,
    select,
    updateBlock,
    moveLayer,
    duplicate,
    remove,
  } = useProject();
  const [menu, setMenu] = useState<string | null>(null),
    [drag, setDrag] = useState<string | null>(null),
    [over, setOver] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    cleanup = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cleanup.current?.();
    },
    [],
  );
  const order = orderedLayers(project.blocks),
    top = [...order].reverse();
  const start = (event: ReactPointerEvent, id: string) => {
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    clearTimeout(timer.current);
    setDrag(id);
    const pointer = event.pointerId,
      element = event.currentTarget as HTMLElement;
    let target = id;
    element.setPointerCapture(pointer);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      const row = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-layer-id]");
      if (row?.dataset.layerId) {
        target = row.dataset.layerId;
        setOver(target);
      }
    };
    const stop = () => {
      cleanup.current?.();
      setDrag(null);
      setOver(null);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) return;
      stop();
      if (target !== id)
        moveLayer(
          id,
          order.findIndex((b) => b.id === target),
        );
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("keydown", key);
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("keydown", key);
      cleanup.current = null;
      try {
        element.releasePointerCapture(pointer);
      } catch {}
    };
  };
  return (
    <div className="layers-list">
      <p className="muted caption">
        Сверху — ближе к зрителю. Потяните за маркер порядка; удерживайте
        название для действий.
      </p>
      {!top.length && <p>Добавьте первый блок.</p>}
      {top.map((block, index) => {
        const group = project.groups?.find((g) => g.id === block.groupId),
          first =
            group && !top.slice(0, index).some((b) => b.groupId === group.id);
        return (
          <Fragment key={block.id}>
            {first && <div className="group-header">{group.name}</div>}
            {
              <div
                key={block.id}
                data-layer-id={block.id}
                className={`layer-row ${selectedIds.includes(block.id) || selectedId === block.id ? "active" : ""} ${over === block.id ? "layer-drop" : ""} ${drag === block.id ? "layer-dragging" : ""}`}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", block.id)
                }
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  moveLayer(
                    e.dataTransfer.getData("text/plain"),
                    order.findIndex((b) => b.id === block.id),
                  );
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu(block.id);
                }}
                onPointerDown={(e) => {
                  if (
                    e.pointerType === "touch" &&
                    (e.target as Element).closest(".layer-select")
                  ) {
                    const x = e.clientX,
                      y = e.clientY;
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => setMenu(block.id), 450);
                    e.currentTarget.dataset.press = `${x},${y}`;
                  }
                }}
                onPointerMove={(e) => {
                  const point = e.currentTarget.dataset.press
                    ?.split(",")
                    .map(Number);
                  if (
                    point &&
                    Math.hypot(e.clientX - point[0], e.clientY - point[1]) > 8
                  )
                    clearTimeout(timer.current);
                }}
                onPointerUp={() => clearTimeout(timer.current)}
                onPointerCancel={() => clearTimeout(timer.current)}
              >
                <div className="layer-main">
                  <button
                    className="layer-grip"
                    aria-label={`Переместить слой: ${block.name}`}
                    title="Перетащить слой"
                    onPointerDown={(e) => start(e, block.id)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                        e.preventDefault();
                        moveLayer(
                          block.id,
                          e.key === "ArrowUp" ? "up" : "down",
                        );
                      }
                    }}
                  >
                    <GripVertical size={16} />
                  </button>
                  <button
                    className="layer-select"
                    onClick={() => select(block.id)}
                  >
                    <small>{index + 1}</small>
                    {createElement(BLOCK_ICONS[block.type], { size: 15 })}
                    <span className="layer-type">{LABELS[block.type]}</span>
                    <span>{block.name}</span>
                  </button>
                  <button
                    aria-label={`${block.hidden ? "Показать" : "Скрыть"}: ${block.name}`}
                    onClick={() =>
                      updateBlock(block.id, { hidden: !block.hidden })
                    }
                  >
                    {block.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    aria-label={`${block.locked ? "Разблокировать" : "Закрепить"}: ${block.name}`}
                    onClick={() =>
                      updateBlock(block.id, { locked: !block.locked })
                    }
                  >
                    {block.locked ? <Lock size={16} /> : <Unlock size={16} />}
                  </button>
                  <button
                    aria-label={`Действия: ${block.name}`}
                    aria-expanded={menu === block.id}
                    onClick={() => setMenu(menu === block.id ? null : block.id)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                <div
                  className={`layer-actions ${menu === block.id ? "layer-menu-open" : ""}`}
                >
                  <button
                    aria-label={`На передний план: ${block.name}`}
                    title="На передний план"
                    disabled={index === 0}
                    onClick={() => moveLayer(block.id, "front")}
                  >
                    <ChevronsUp size={16} />
                  </button>
                  <button
                    aria-label={`Выше: ${block.name}`}
                    title="На уровень выше"
                    disabled={index === 0}
                    onClick={() => moveLayer(block.id, "up")}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label={`Ниже: ${block.name}`}
                    title="На уровень ниже"
                    disabled={index === top.length - 1}
                    onClick={() => moveLayer(block.id, "down")}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    aria-label={`На задний план: ${block.name}`}
                    title="На задний план"
                    disabled={index === top.length - 1}
                    onClick={() => moveLayer(block.id, "back")}
                  >
                    <ChevronsDown size={16} />
                  </button>
                  <button
                    aria-label={`Дублировать: ${block.name}`}
                    title="Дублировать"
                    onClick={() => duplicate(block.id)}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    aria-label={`Удалить: ${block.name}`}
                    title="Удалить"
                    onClick={() => remove(block.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            }
          </Fragment>
        );
      })}
    </div>
  );
}
